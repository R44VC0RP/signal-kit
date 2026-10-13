"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { YouTubeModeratorIcon, YouTubeVerifiedIcon } from "@/components/brand/platforms";
import { XVerifiedBadge } from "@/components/brand/x";
import { PlatformLogo } from "@/components/dashboard/PlatformLogo";
import type { SignalKitEvent } from "@/lib/events/types";
import {
  fontStack,
  googleFontsUrl,
  type AlertKind,
  type AlertSettings,
  type AnySettings,
  type ChatSettings,
  type EventListSettings,
  type OverlayType,
} from "@/lib/overlays/settings";
import { alertText, hasBlockedWord, isBot, matchesAlert, nameColor } from "./describe";
import "./overlay.css";

/**
 * What viewers see. Used by the browser-source page and by the customizer preview, so the
 * preview is exactly what OBS shows. `events` only ever grows (newest last); each overlay
 * keeps track of which ids it has already handled.
 */
export function OverlayRenderer({ type, settings, events }: { type: OverlayType; settings: AnySettings; events: SignalKitEvent[] }) {
  const style = {
    "--sk-scale": settings.scale,
    "--sko-font": fontStack(settings.font),
    "--sko-text": settings.textColor,
    "--sko-accent": settings.accentColor,
    "--sko-panel": hexToRgba(settings.panelColor, settings.panelOpacity),
    "--sko-radius": `${settings.radius / 16}em`,
    ...("durationSec" in settings ? { "--sko-duration": `${settings.durationSec}s` } : {}),
  } as CSSProperties;
  const fontUrl = googleFontsUrl([settings.font]);
  return (
    <div className="sko-root" data-style={settings.style} data-type={type} data-animation={"animation" in settings ? settings.animation : undefined} style={style}>
      {fontUrl ? <link rel="stylesheet" href={fontUrl} precedence="default" /> : null}
      {settings.customCss ? <style>{settings.customCss}</style> : null}
      {type === "alerts" ? (
        <AlertsOverlay settings={settings as AlertSettings} events={events} />
      ) : type === "chat" ? (
        <ChatOverlay settings={settings as ChatSettings} events={events} />
      ) : (
        <EventListOverlay settings={settings as EventListSettings} events={events} />
      )}
    </div>
  );
}

// ---- Alerts ---------------------------------------------------------------------------------

const EXIT_MS = 450;
/** Breathing room between queued alerts. */
const GAP_MS = 400;

function AlertsOverlay({ settings, events }: { settings: AlertSettings; events: SignalKitEvent[] }) {
  const handled = useRef(new Set<string>());
  const queue = useRef<SignalKitEvent[]>([]);
  const [current, setCurrent] = useState<{ event: SignalKitEvent; leaving: boolean } | null>(null);
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Queue new matching events; ignore ones that were already in the list when we mounted.
  const primed = useRef(false);
  /** True for a moment after an alert leaves, so queued alerts don't run into each other. */
  const cooling = useRef(false);
  useEffect(() => {
    for (const event of events) {
      if (handled.current.has(event.id)) {
        continue;
      }
      handled.current.add(event.id);
      if (primed.current && matchesAlert(event, settings)) {
        queue.current.push(event);
      }
    }
    primed.current = true;
    if (!current && !cooling.current && queue.current.length > 0) {
      setCurrent({ event: queue.current.shift()!, leaving: false });
    }
  }, [events, settings, current]);

  // One alert at a time: show, hold for the duration, play the exit, then take the next one.
  useEffect(() => {
    if (!current || current.leaving) {
      return;
    }
    const live = settingsRef.current;
    if (live.sound) {
      const custom = live.templates[current.event.kind as AlertKind]?.sound;
      if (custom) {
        playSound(custom, live.volume);
      } else {
        playChime(live.volume, current.event.kind === "tip" || current.event.kind === "raid");
      }
    }
    const hold = setTimeout(() => setCurrent((value) => (value ? { ...value, leaving: true } : value)), live.durationSec * 1000);
    return () => clearTimeout(hold);
  }, [current]);

  useEffect(() => {
    if (!current?.leaving) {
      return;
    }
    const exit = setTimeout(() => {
      cooling.current = true;
      setCurrent(null);
      // After an alert leaves, wait a beat before the next one.
      setTimeout(() => {
        cooling.current = false;
        if (queue.current.length > 0) {
          setCurrent({ event: queue.current.shift()!, leaving: false });
        }
      }, GAP_MS);
    }, EXIT_MS);
    return () => clearTimeout(exit);
  }, [current]);

  if (!current) {
    return null;
  }
  const { event, leaving } = current;
  const text = alertText(event, settings.templates);
  const image = settings.templates[event.kind as AlertKind]?.image;
  const message = settings.showMessage && !hasBlockedWord(event.message, settings.blockedWords) ? event.message : null;
  const money = event.kind === "tip";
  return (
    <div className="sko-alert-stage" data-position={settings.position}>
      <div key={event.id} className="sko-alert-wrap" data-leaving={leaving || undefined}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {image ? <img className="sko-alert-image" src={image} alt="" referrerPolicy="no-referrer" /> : null}
        <div className="sko-alert" data-kind={event.kind} data-money={money || undefined}>
          {settings.showAvatar ? <Avatar name={event.actor?.name ?? "?"} url={event.actor?.avatarUrl} size="alert" platform={event.platform} /> : null}
          <div className="sko-alert-body">
            <div className="sko-alert-eyebrow">
              {settings.showAvatar ? null : <PlatformLogo platform={event.platform} size={14} />}
              <span>{text.label}</span>
            </div>
            <div className="sko-alert-title">
              {text.parts.map((part, index) =>
                part.variable === "name" ? (
                  <span key={index} className="sko-name">
                    {part.text}
                    <Verified event={event} />
                  </span>
                ) : (
                  <span key={index} className={part.variable === "amount" ? "sko-amount" : undefined}>
                    {part.text}
                  </span>
                ),
              )}
            </div>
            {text.detail ? <div className="sko-alert-detail">{text.detail}</div> : null}
            {message ? <div className="sko-alert-message">{message}</div> : null}
          </div>
          <span className="sko-alert-countdown" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

/** A streamer's own alert sound (any HTTPS audio URL). */
function playSound(url: string, volume: number) {
  try {
    const sound = new Audio(url);
    sound.volume = volume;
    void sound.play().catch(() => {});
  } catch {
    // Unsupported or blocked audio; the alert still shows.
  }
}

/** A short two-note chime, synthesized so there's no audio file to load. */
let audio: AudioContext | null = null;
function playChime(volume: number, big: boolean) {
  try {
    audio ??= new AudioContext();
    const ctx = audio;
    const notes = big ? [659.25, 880, 1318.5] : [659.25, 987.77];
    notes.forEach((frequency, index) => {
      const start = ctx.currentTime + index * 0.12;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.25 * volume, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.9);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 1);
    });
  } catch {
    // No audio available (e.g. a browser that blocks autoplay); alerts still show.
  }
}

// ---- Chat -----------------------------------------------------------------------------------

const HIGHLIGHT_KINDS = new Set(["tip", "subscription", "subscription.gift"]);

function ChatOverlay({ settings, events }: { settings: ChatSettings; events: SignalKitEvent[] }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (settings.lifetimeSec <= 0) {
      return;
    }
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [settings.lifetimeSec]);

  const lines = events
    .filter((event) => {
      if (!settings.platforms[event.platform]) {
        return false;
      }
      if (event.kind === "chat.message") {
        return true;
      }
      if (event.kind === "tip") {
        return settings.showTips;
      }
      return (event.kind === "subscription" || event.kind === "subscription.gift") && settings.showSubs;
    })
    .filter((event) => !(settings.hideCommands && event.kind === "chat.message" && event.message?.trim().startsWith("!")))
    .filter((event) => !(settings.hideBots && isBot(event)))
    .filter((event) => !hasBlockedWord(event.message, settings.blockedWords))
    .slice(-settings.maxMessages);
  const lifetimeMs = settings.lifetimeSec * 1000;
  const ageOf = (event: SignalKitEvent) => Math.max(0, now - (Date.parse(event.receivedAt) || now));
  const visible = lifetimeMs > 0 ? lines.filter((line) => ageOf(line) < lifetimeMs + 600) : lines;
  const ordered = settings.newestAt === "top" ? [...visible].reverse() : visible;

  if (ordered.length === 0) {
    return null;
  }
  return (
    <div className="sko-chat" data-newest={settings.newestAt}>
      <div className="sko-chat-box">
        {ordered.map((event) => {
          const fading = lifetimeMs > 0 && ageOf(event) > lifetimeMs;
          const highlight = HIGHLIGHT_KINDS.has(event.kind);
          const name = event.actor?.name ?? "Someone";
          const twitchColor = typeof event.data?.color === "string" && /^#[0-9a-f]{6}$/i.test(event.data.color) ? event.data.color : null;
          const color = settings.nameColor === "viewer" ? (twitchColor ? brighten(twitchColor) : nameColor(name)) : undefined;
          return (
            <div key={event.id} className="sko-chat-line" data-fading={fading || undefined} data-highlight={highlight || undefined} data-platform={event.platform}>
              {settings.showAvatars ? <Avatar name={name} url={event.actor?.avatarUrl} size="chat" /> : null}
              <div className="sko-chat-body">
                <div className="sko-chat-meta">
                  {settings.showPlatform ? (
                    <span className="sko-chat-platform">
                      <PlatformLogo platform={event.platform} size={13} />
                    </span>
                  ) : null}
                  {settings.showBadges ? <Badges event={event} /> : null}
                  <span className="sko-chat-name" data-role={youtubeRole(event)} style={color && !youtubeRole(event) ? { color } : undefined}>
                    {name}
                  </span>
                  {settings.showBadges ? <Verified event={event} /> : null}
                  {highlight ? <span className="sko-chat-amount">{event.kind === "tip" ? event.amount?.display : alertText(event).title.replace(name, "").trim()}</span> : null}
                </div>
                {event.message ? <div className="sko-chat-text">{event.message}</div> : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const BADGE_LABEL: Record<string, string> = {
  broadcaster: "Host",
  owner: "Host",
  moderator: "Mod",
  vip: "VIP",
  subscriber: "Sub",
  member: "Member",
};

/**
 * Badges before the name, the way each platform shows them: Twitch's own badge images (the
 * channel's custom sub badges included), YouTube's moderator wrench and member tag, and
 * text tags for X's subscriber/moderator flags.
 */
function Badges({ event }: { event: SignalKitEvent }) {
  const images = event.platform === "twitch" ? (event.actor?.badgeImages ?? []) : [];
  if (images.length > 0) {
    return (
      <>
        {images.slice(0, 4).map((badge) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={`${badge.set}/${badge.id}`} className="sko-badge-img" src={badge.url} alt={badge.title} title={badge.title} referrerPolicy="no-referrer" />
        ))}
      </>
    );
  }
  const badges = event.actor?.badges ?? [];
  if (event.platform === "youtube") {
    return (
      <>
        {badges.includes("moderator") ? (
          <span className="sko-badge-icon">
            <YouTubeModeratorIcon size={16} />
          </span>
        ) : null}
        {badges.includes("member") ? (
          <span className="sko-badge" data-badge="member">
            Member
          </span>
        ) : null}
      </>
    );
  }
  const shown = badges.filter((badge) => BADGE_LABEL[badge]).slice(0, 3);
  return (
    <>
      {shown.map((badge) => (
        <span key={badge} className="sko-badge" data-badge={badge}>
          {BADGE_LABEL[badge]}
        </span>
      ))}
    </>
  );
}

/** YouTube highlights the channel owner's name (yellow) and members' names (green). */
function youtubeRole(event: SignalKitEvent) {
  if (event.platform !== "youtube") {
    return undefined;
  }
  const badges = event.actor?.badges ?? [];
  return badges.includes("owner") ? "owner" : badges.includes("member") ? "member" : undefined;
}

/**
 * Verification shown after the name: X's own badges (Premium blue, Business gold, Government
 * gray, from the X Partner Icon Kit); a plain check for other platforms' verified channels.
 */
function Verified({ event }: { event: SignalKitEvent }) {
  const badges = event.actor?.badges ?? [];
  if (event.platform === "x") {
    const type = badges.includes("verified-business") ? "business" : badges.includes("verified-government") ? "government" : badges.includes("verified") ? "blue" : null;
    return type ? (
      <span className="sko-verified">
        <XVerifiedBadge type={type} size={16} />
      </span>
    ) : null;
  }
  if (event.platform === "youtube" && badges.includes("verified")) {
    return (
      <span className="sko-verified">
        <YouTubeVerifiedIcon size={16} />
      </span>
    );
  }
  return null;
}

// ---- Event list -----------------------------------------------------------------------------

function EventListOverlay({ settings, events }: { settings: EventListSettings; events: SignalKitEvent[] }) {
  const items = events.filter((event) => matchesAlert(event, settings)).slice(-settings.maxItems).reverse();
  return (
    <div className="sko-list">
      {items.map((event) => {
        const text = alertText(event);
        return (
          <div key={event.id} className="sko-list-item" data-kind={event.kind}>
            {settings.showAvatars ? <Avatar name={event.actor?.name ?? "?"} url={event.actor?.avatarUrl} size="chat" /> : null}
            <div className="sko-list-body">
              <span className="sko-list-title">{text.title}</span>
              {text.detail ? <span className="sko-list-detail">{text.detail}</span> : null}
            </div>
            <span className="sko-list-platform">
              <PlatformLogo platform={event.platform} size={12} />
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ---- Shared ---------------------------------------------------------------------------------

function hexToRgba(hex: string, alpha: number) {
  const value = parseInt(hex.replace("#", ""), 16);
  return `rgb(${(value >> 16) & 255} ${(value >> 8) & 255} ${value & 255} / ${Math.round(alpha * 100)}%)`;
}

/** Twitch name colours are picked for white backgrounds; lift dark ones so they read on stream. */
function brighten(hex: string) {
  return `color-mix(in oklab, ${hex} 70%, white)`;
}

function Avatar({ name, url, size, platform }: { name: string; url?: string | null; size: "alert" | "chat"; platform?: SignalKitEvent["platform"] }) {
  const [failed, setFailed] = useState(false);
  const className = `sko-avatar sko-avatar-${size}`;
  const face =
    url && !failed ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img className={className} src={url} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
    ) : (
      <span className={className} style={{ background: `linear-gradient(135deg, ${nameColor(name)}, ${nameColor(`${name}~`)})` }}>
        {name.replace(/^@/, "").charAt(0).toUpperCase()}
      </span>
    );
  if (!platform) {
    return face;
  }
  return (
    <span className="sko-avatar-wrap">
      {face}
      <span className="sko-avatar-platform">
        <PlatformLogo platform={platform} size={18} />
      </span>
    </span>
  );
}
