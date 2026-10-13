"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { YouTubeModeratorIcon, YouTubeVerifiedIcon } from "@/components/brand/platforms";
import { XVerifiedBadge } from "@/components/brand/x";
import { PlatformLogo } from "@/components/dashboard/PlatformLogo";
import type { SignalKitEvent } from "@/lib/events/types";
import {
  fontStack,
  googleFontsUrl,
  type AlertSettings,
  type AnySettings,
  type Appearance,
  type ChatSettings,
  type CreditsSettings,
  type GiveawaySettings,
  type HighlightSettings,
  type PollSettings,
  type QueueSettings,
  type TwitchActivitySettings,
  type ViewersSettings,
  type WheelSettings,
  type BossSettings,
  type EmoteWallSettings,
  type EventListSettings,
  type GoalSettings,
  type LabelSettings,
  type OverlayType,
  type TickerSettings,
} from "@/lib/overlays/settings";
import type { PublicLiveTools } from "@/lib/live/types";
import type { PublicStats } from "@/lib/overlays/stats-core";
import type { CreditsData, LiveSnapshot } from "@/lib/streams/summary";
import { alertText, defaultNameColor, hasBlockedWord, isBot, isMuted, matchesAlert, nameColor, shortAction, templateParts } from "./describe";
import { MessageText } from "./MessageText";
import { BossWidget, CreditsWidget, GiveawayWidget, HighlightWidget, PollWidget, QueueWidget, TwitchActivityWidget, ViewersWidget, WheelWidget } from "./live-widgets";
import { EmoteWall, GoalWidget, LabelWidget, Ticker } from "./widgets";
import "./animations.css";
import "./overlay.css";

/** An event as an overlay holds it: `seenAt` is when this browser received it (for delays and fades). */
export type OverlayEvent = SignalKitEvent & { seenAt?: number; test?: boolean };

const SHADOWS: Record<Appearance["textShadow"], string> = {
  outline: "0 0 1px #000, 0 0 2px #000, 0 0 3px #000, 0 0 4px #000",
  soft: "0 2px 3px rgb(0 0 0 / 60%), 0 8px 32px rgb(0 0 0 / 55%)",
  heavy: "0 0 2px #000, 2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 0 4px 10px rgb(0 0 0 / 60%)",
  glow: "0 0 1px #000, 0 0 0.3em var(--sko-accent), 0 0 0.8em color-mix(in srgb, var(--sko-accent) 60%, transparent)",
  none: "none",
};

/**
 * What viewers see. Used by the browser-source page and by the customizer preview, so the
 * preview is exactly what OBS shows. `events` only ever grows (newest last) and holds what
 * arrived live; `history` is what was already there when the overlay loaded (lists show it,
 * alerts never replay it). `stats` feeds goals and labels.
 */
export function OverlayRenderer({
  type,
  settings,
  events,
  history = EMPTY,
  stats = null,
  overlayId = "",
  tools = null,
  stream = null,
  credits = null,
  preview = false,
}: {
  /** The customizer's preview: show idle widgets (e.g. the wheel) that would otherwise hide. */
  preview?: boolean;
  type: OverlayType;
  settings: AnySettings;
  events: OverlayEvent[];
  history?: OverlayEvent[];
  stats?: PublicStats | null;
  overlayId?: string;
  tools?: PublicLiveTools | null;
  stream?: LiveSnapshot | null;
  credits?: CreditsData | null;
}) {
  const style = {
    "--sk-scale": settings.scale,
    "--sko-font": fontStack(settings.font),
    "--sko-weight": settings.fontWeight,
    "--sko-text": settings.textColor,
    "--sko-accent": settings.accentColor,
    "--sko-panel": hexToRgba(settings.panelColor, settings.panelOpacity),
    "--sko-radius": `${settings.radius / 16}em`,
    "--sko-shadow": SHADOWS[settings.textShadow] ?? "none",
    ...("fontSize" in settings ? { "--sko-size": settings.fontSize / 16 } : {}),
    ...("durationSec" in settings ? { "--sko-duration": `${settings.durationSec}s` } : {}),
  } as CSSProperties;
  const fontUrl = googleFontsUrl([settings.font]);
  const all = useMemo(() => mergeEvents(history, events), [history, events]);
  return (
    <div className="sko-root" data-style={settings.style} data-type={type} style={style}>
      {fontUrl ? <link rel="stylesheet" href={fontUrl} precedence="default" /> : null}
      {settings.customCss ? <style>{settings.customCss}</style> : null}
      {type === "alerts" ? (
        <AlertsOverlay settings={settings as AlertSettings} events={events} />
      ) : type === "chat" ? (
        <ChatOverlay settings={settings as ChatSettings} events={all} />
      ) : type === "events" ? (
        <EventListOverlay settings={settings as EventListSettings} events={all} />
      ) : type === "goal" ? (
        <GoalWidget settings={settings as GoalSettings} stats={stats} events={events} overlayId={overlayId} />
      ) : type === "label" ? (
        <LabelWidget settings={settings as LabelSettings} stats={stats} events={events} />
      ) : type === "emotewall" ? (
        <EmoteWall settings={settings as EmoteWallSettings} events={events} />
      ) : type === "ticker" ? (
        <Ticker settings={settings as TickerSettings} events={all} />
      ) : type === "poll" ? (
        <PollWidget settings={settings as PollSettings} tools={tools} />
      ) : type === "giveaway" ? (
        <GiveawayWidget settings={settings as GiveawaySettings} tools={tools} />
      ) : type === "queue" ? (
        <QueueWidget settings={settings as QueueSettings} tools={tools} />
      ) : type === "highlight" ? (
        <HighlightWidget settings={settings as HighlightSettings} tools={tools} />
      ) : type === "viewers" ? (
        <ViewersWidget settings={settings as ViewersSettings} stream={stream} />
      ) : type === "credits" ? (
        <CreditsWidget settings={settings as CreditsSettings} credits={credits} />
      ) : type === "wheel" ? (
        <WheelWidget settings={settings as WheelSettings} tools={tools} events={events} preview={preview} />
      ) : type === "boss" ? (
        <BossWidget settings={settings as BossSettings} stats={stats} events={events} />
      ) : (
        <TwitchActivityWidget settings={settings as TwitchActivitySettings} events={all} />
      )}
    </div>
  );
}

const EMPTY: OverlayEvent[] = [];

function mergeEvents(history: OverlayEvent[], events: OverlayEvent[]) {
  if (history.length === 0) {
    return events;
  }
  const live = new Set(events.map((event) => event.id));
  return [...history.filter((event) => !live.has(event.id)), ...events];
}

/** animate.css class for a named animation ("none" disables it). */
export function anim(name: string) {
  return name === "none" ? "" : `sko-anim-${name}`;
}

// ---- Alerts ---------------------------------------------------------------------------------

/** animate.css's standard duration; alerts animate in and out over this long. */
const ANIMATION_MS = 1000;

function AlertsOverlay({ settings, events }: { settings: AlertSettings; events: OverlayEvent[] }) {
  const handled = useRef(new Set<string>());
  const queue = useRef<OverlayEvent[]>([]);
  const [current, setCurrent] = useState<{ event: OverlayEvent; leaving: boolean } | null>(null);
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
      playSound(alertText(current.event, live.templates).sound, live.volume);
    }
    const hold = setTimeout(() => setCurrent((value) => (value ? { ...value, leaving: true } : value)), live.durationSec * 1000);
    return () => clearTimeout(hold);
  }, [current]);

  useEffect(() => {
    if (!current?.leaving) {
      return;
    }
    const exit = setTimeout(
      () => {
        cooling.current = true;
        setCurrent(null);
        setTimeout(() => {
          cooling.current = false;
          if (queue.current.length > 0) {
            setCurrent({ event: queue.current.shift()!, leaving: false });
          }
        }, settingsRef.current.gapSec * 1000);
      },
      settingsRef.current.animationOut === "none" ? 0 : ANIMATION_MS,
    );
    return () => clearTimeout(exit);
  }, [current]);

  if (!current) {
    return null;
  }
  const { event, leaving } = current;
  const text = alertText(event, settings.templates);
  const message = settings.showMessage && !hasBlockedWord(event.message, settings.blockedWords) ? event.message : null;
  const classic = settings.style === "classic";
  const vars = {
    "--sko-title-size": `${settings.titleSize / 16}em`,
    "--sko-message-size": `${settings.messageSize / 16}em`,
    "--sko-image-size": `${settings.imageSize / 16}em`,
    "--sko-message-color": settings.messageColor,
  } as CSSProperties;
  return (
    <div className="sko-alert-stage" data-position={settings.position} style={vars}>
      <div key={event.id} className={`sko-alert-wrap ${anim(leaving ? settings.animationOut : settings.animationIn)}`} data-leaving={leaving || undefined}>
        {classic ? (
          <div className="sko-classic" data-layout={settings.layout} data-kind={event.kind}>
            {text.image ? <AlertArt key={text.image} url={text.image} isDefault={text.image.startsWith("/alerts/art/")} /> : null}
            <div className="sko-classic-text" data-delayed={settings.textDelaySec > 0 || undefined} style={settings.textDelaySec > 0 ? { animationDelay: `${settings.textDelaySec}s` } : undefined}>
              <div className="sko-classic-title">
                <TitleParts event={event} parts={text.parts} animation={settings.textAnimation} />
              </div>
              {message ? (
                <div className="sko-classic-message">
                  <MessageText text={message} parts={event.messageParts} />
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <>
            {text.customImage ? <AlertArt key={text.customImage} url={text.customImage} isDefault={false} /> : null}
            <div className="sko-alert" data-kind={event.kind} data-money={event.kind === "tip" || undefined}>
              {settings.showAvatar ? <Avatar name={event.actor?.name ?? "?"} url={event.actor?.avatarUrl} size="alert" platform={event.platform} /> : null}
              <div className="sko-alert-body">
                <div className="sko-alert-eyebrow">
                  {settings.showAvatar ? null : <PlatformLogo platform={event.platform} size={14} />}
                  <span>{text.label}</span>
                </div>
                <div className="sko-alert-title">
                  <TitleParts event={event} parts={text.parts} animation={settings.textAnimation} />
                </div>
                {text.detail ? <div className="sko-alert-detail">{text.detail}</div> : null}
                {message ? (
                  <div className="sko-alert-message">
                    <MessageText text={message} parts={event.messageParts} />
                  </div>
                ) : null}
              </div>
              <span className="sko-alert-countdown" aria-hidden="true" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** The headline with its variables ({name}, {amount}…) highlighted and, optionally, animated letter by letter. */
function TitleParts({ event, parts, animation }: { event: SignalKitEvent; parts: ReturnType<typeof templateParts>; animation: string }) {
  return (
    <>
      {parts.map((part, index) =>
        part.variable ? (
          <span key={index} className={`sko-hl${part.variable === "name" ? " sko-name" : ""}${part.variable === "amount" ? " sko-amount" : ""}`} data-var={part.variable}>
            <AnimatedLetters text={part.text} animation={animation} />
            {part.variable === "name" ? <Verified event={event} /> : null}
          </span>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  );
}

/** Each letter animates on its own, 0.1 s after the one before (as Streamlabs and StreamElements do). */
export function AnimatedLetters({ text, animation }: { text: string; animation: string }) {
  if (animation === "none" || !text) {
    return <>{text}</>;
  }
  const letters = graphemes(text);
  return (
    <>
      {letters.map((letter, index) =>
        letter.trim() ? (
          <span key={index} className={`sko-letter sko-text-${animation}`} style={{ animationDelay: `${(index % 30) * 0.1}s` }}>
            {letter}
          </span>
        ) : (
          letter
        ),
      )}
    </>
  );
}

function graphemes(text: string) {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    return [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)].map((part) => part.segment);
  }
  return Array.from(text);
}

/** Alert art: an image, GIF or WebM/MP4 video. Signal Kit's own art floats gently. */
function AlertArt({ url, isDefault }: { url: string; isDefault: boolean }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return null;
  }
  if (/\.(webm|mp4)(\?|#|$)/i.test(url)) {
    return <video className="sko-alert-image" src={url} autoPlay muted loop playsInline onError={() => setFailed(true)} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="sko-alert-image" data-default={isDefault || undefined} src={url} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
  );
}

/** Plays an alert sound (Signal Kit's default or the streamer's HTTPS URL). */
function playSound(url: string, volume: number) {
  try {
    const sound = new Audio(url);
    sound.volume = Math.min(1, Math.max(0, volume));
    void sound.play().catch(() => {});
  } catch {
    // Unsupported or blocked audio; the alert still shows.
  }
}

// ---- Chat -----------------------------------------------------------------------------------

const HIGHLIGHT_KINDS = new Set(["tip", "subscription", "subscription.gift"]);

function ChatOverlay({ settings, events }: { settings: ChatSettings; events: OverlayEvent[] }) {
  const [now, setNow] = useState(() => Date.now());
  const ticking = settings.lifetimeSec > 0 || settings.delaySec > 0;
  useEffect(() => {
    if (!ticking) {
      return;
    }
    const tick = setInterval(() => setNow(Date.now()), settings.delaySec > 0 ? 250 : 1000);
    return () => clearInterval(tick);
  }, [ticking, settings.delaySec]);

  // Messages a moderator deleted disappear, as they do in Twitch and YouTube chat.
  const deleted = new Set(events.filter((event) => event.kind === "chat.message.deleted").map((event) => String(event.data?.messageId ?? "")));
  const ageOf = (event: OverlayEvent) => now - (event.seenAt ?? (Date.parse(event.receivedAt) || now));
  const delayMs = settings.delaySec * 1000;
  const lines = events
    .filter((event) => {
      if (!settings.platforms[event.platform]) {
        return false;
      }
      if (event.kind === "chat.message") {
        return !deleted.has(String(event.data?.messageId ?? "-"));
      }
      if (event.kind === "tip") {
        return settings.showTips;
      }
      return (event.kind === "subscription" || event.kind === "subscription.gift") && settings.showSubs;
    })
    .filter((event) => !(settings.hideCommands && event.kind === "chat.message" && event.message?.trim().startsWith("!")))
    .filter((event) => !(settings.hideBots && isBot(event)))
    .filter((event) => !isMuted(event, settings.mutedUsers))
    .filter((event) => !hasBlockedWord(event.message, settings.blockedWords))
    .filter((event) => delayMs === 0 || ageOf(event) >= delayMs)
    .slice(-settings.maxMessages);
  const lifetimeMs = settings.lifetimeSec * 1000;
  const visible = lifetimeMs > 0 ? lines.filter((line) => ageOf(line) < lifetimeMs + delayMs + 600) : lines;
  const ordered = settings.newestAt === "top" ? [...visible].reverse() : visible;

  if (ordered.length === 0) {
    return null;
  }
  const classic = settings.style === "classic";
  return (
    <div className="sko-chat" data-newest={settings.newestAt} data-layout={classic ? settings.layout : undefined}>
      <div className="sko-chat-box">
        {ordered.map((event) => {
          const fading = lifetimeMs > 0 && ageOf(event) > lifetimeMs + delayMs;
          const highlight = HIGHLIGHT_KINDS.has(event.kind);
          const name = event.actor?.name ?? "Someone";
          const twitchColor = typeof event.data?.color === "string" && /^#[0-9a-f]{6}$/i.test(event.data.color) ? event.data.color : null;
          const color =
            settings.nameColor === "viewer" ? (classic ? (twitchColor ?? defaultNameColor(name)) : twitchColor ? brighten(twitchColor) : nameColor(name)) : undefined;
          const role = youtubeRole(event);
          const nameNode = (
            <span className="sko-chat-name" data-role={role} style={color && !role ? { color } : undefined}>
              {name}
            </span>
          );
          const extra = highlight ? <span className="sko-chat-amount">{event.kind === "tip" ? event.amount?.display : shortAction(event).action}</span> : null;
          const text = event.message ? <MessageText className="sko-chat-text" text={event.message} parts={event.messageParts} /> : null;
          const lineProps = {
            className: `sko-chat-line ${anim(settings.animation)}`,
            "data-fading": fading || undefined,
            "data-highlight": highlight || undefined,
            "data-platform": event.platform,
          };
          if (classic) {
            const meta = (
              <>
                {settings.showAvatars ? <Avatar name={name} url={event.actor?.avatarUrl} size="chat" /> : null}
                {settings.showPlatform ? (
                  <span className="sko-chat-platform">
                    <PlatformLogo platform={event.platform} size={13} />
                  </span>
                ) : null}
                {settings.showBadges ? <Badges event={event} /> : null}
                {nameNode}
                {settings.showBadges ? <Verified event={event} /> : null}
              </>
            );
            return settings.layout === "columns" ? (
              <div key={event.id} {...lineProps}>
                <span className="sko-chat-meta">{meta}</span>
                <span className="sko-chat-message">
                  {extra}
                  {extra && text ? " " : null}
                  {text}
                </span>
              </div>
            ) : (
              <div key={event.id} {...lineProps}>
                {meta}
                {settings.showColon && !highlight ? <span className="sko-chat-colon">:</span> : null}{" "}
                {extra}
                {extra && text ? " " : null}
                {text}
              </div>
            );
          }
          return (
            <div key={event.id} {...lineProps}>
              {settings.showAvatars ? <Avatar name={name} url={event.actor?.avatarUrl} size="chat" /> : null}
              <div className="sko-chat-body">
                <div className="sko-chat-meta">
                  {settings.showPlatform ? (
                    <span className="sko-chat-platform">
                      <PlatformLogo platform={event.platform} size={13} />
                    </span>
                  ) : null}
                  {settings.showBadges ? <Badges event={event} /> : null}
                  {nameNode}
                  {settings.showBadges ? <Verified event={event} /> : null}
                  {extra}
                </div>
                {text}
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
 * gray, from the X Partner Icon Kit); YouTube's check for verified channels.
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

function EventListOverlay({ settings, events }: { settings: EventListSettings; events: OverlayEvent[] }) {
  const latest = events.filter((event) => matchesAlert(event, settings)).slice(-settings.maxItems);
  const items = settings.newestAt === "top" ? latest.reverse() : latest;
  return (
    <div className="sko-list" data-newest={settings.newestAt}>
      {items.map((event) => {
        const { name, action, amount } = shortAction(event);
        return (
          <div key={event.id} className={`sko-list-item ${anim(settings.animation)}`} data-kind={event.kind}>
            {settings.showAvatars ? <Avatar name={name} url={event.actor?.avatarUrl} size="chat" /> : null}
            <div className="sko-list-body">
              <span className="sko-list-name">{name}</span>
              <span className="sko-list-action">
                {action}
                {amount ? <span className="sko-list-amount"> {amount}</span> : null}
              </span>
            </div>
            {settings.showPlatform ? (
              <span className="sko-list-platform">
                <PlatformLogo platform={event.platform} size={12} />
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

// ---- Shared ---------------------------------------------------------------------------------

export function hexToRgba(hex: string, alpha: number) {
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
  const face: ReactNode =
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
