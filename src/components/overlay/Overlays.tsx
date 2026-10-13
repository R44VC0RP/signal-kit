"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { PlatformLogo } from "@/components/dashboard/PlatformLogo";
import type { SignalKitEvent } from "@/lib/events/types";
import type { AlertSettings, AnySettings, ChatSettings, EventListSettings, OverlayType } from "@/lib/overlays/settings";
import { alertText, matchesAlert, nameColor } from "./describe";
import "./overlay.css";

/**
 * What viewers see. Used by the browser-source page and by the customizer preview, so the
 * preview is exactly what OBS shows. `events` only ever grows (newest last); each overlay
 * keeps track of which ids it has already handled.
 */
export function OverlayRenderer({ type, settings, events }: { type: OverlayType; settings: AnySettings; events: SignalKitEvent[] }) {
  const style = { "--sk-scale": settings.scale } as CSSProperties;
  return (
    <div className="sko-root" data-style={settings.style} data-type={type} style={style}>
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
    if (!current && queue.current.length > 0) {
      setCurrent({ event: queue.current.shift()!, leaving: false });
    }
  }, [events, settings, current]);

  // One alert at a time: show, hold for the duration, play the exit, then take the next one.
  useEffect(() => {
    if (!current || current.leaving) {
      return;
    }
    if (settingsRef.current.sound) {
      playChime(settingsRef.current.volume, current.event.kind === "tip" || current.event.kind === "raid");
    }
    const hold = setTimeout(() => setCurrent((value) => (value ? { ...value, leaving: true } : value)), settingsRef.current.durationSec * 1000);
    return () => clearTimeout(hold);
  }, [current]);

  useEffect(() => {
    if (!current?.leaving) {
      return;
    }
    const exit = setTimeout(() => setCurrent(queue.current.length > 0 ? { event: queue.current.shift()!, leaving: false } : null), EXIT_MS);
    return () => clearTimeout(exit);
  }, [current]);

  if (!current) {
    return null;
  }
  const { event, leaving } = current;
  const text = alertText(event);
  const message = settings.showMessage ? event.message : null;
  return (
    <div className="sko-alert-stage" data-position={settings.position}>
      <div key={event.id} className="sko-alert" data-kind={event.kind} data-leaving={leaving || undefined}>
        {settings.showAvatar ? <Avatar name={event.actor?.name ?? "?"} url={event.actor?.avatarUrl} size="alert" /> : null}
        <div className="sko-alert-body">
          <div className="sko-alert-eyebrow">
            <PlatformLogo platform={event.platform} size={14} />
            <span>{KIND_LABEL[event.kind] ?? "Alert"}</span>
          </div>
          <div className="sko-alert-title">{text.title}</div>
          {text.detail ? <div className="sko-alert-detail">{text.detail}</div> : null}
          {message ? <div className="sko-alert-message">{message}</div> : null}
        </div>
      </div>
    </div>
  );
}

const KIND_LABEL: Record<string, string> = {
  follow: "New follower",
  subscription: "New subscriber",
  "subscription.gift": "Gift subs",
  tip: "Tip",
  raid: "Raid",
  redemption: "Redemption",
};

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

function ChatOverlay({ settings, events }: { settings: ChatSettings; events: SignalKitEvent[] }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (settings.lifetimeSec <= 0) {
      return;
    }
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [settings.lifetimeSec]);

  const messages = events
    .filter((event) => event.kind === "chat.message" && settings.platforms[event.platform])
    .filter((event) => !(settings.hideCommands && event.message?.trim().startsWith("!")))
    .slice(-settings.maxMessages);
  const lifetimeMs = settings.lifetimeSec * 1000;
  const ageOf = (event: SignalKitEvent) => Math.max(0, now - (Date.parse(event.receivedAt) || now));
  const visible = lifetimeMs > 0 ? messages.filter((message) => ageOf(message) < lifetimeMs + 600) : messages;

  return (
    <div className="sko-chat">
      {visible.map((event) => {
        const fading = lifetimeMs > 0 && ageOf(event) > lifetimeMs;
        return (
          <div key={event.id} className="sko-chat-line" data-fading={fading || undefined}>
            {settings.showAvatars ? <Avatar name={event.actor?.name ?? "?"} url={event.actor?.avatarUrl} size="chat" /> : null}
            <div className="sko-chat-body">
              <div className="sko-chat-meta">
                {settings.showPlatform ? (
                  <span className="sko-chat-platform">
                    <PlatformLogo platform={event.platform} size={12} />
                  </span>
                ) : null}
                <span className="sko-chat-name">{event.actor?.name ?? "Someone"}</span>
                {settings.showBadges ? <Badges badges={event.actor?.badges ?? []} /> : null}
              </div>
              <div className="sko-chat-text">{event.message}</div>
            </div>
          </div>
        );
      })}
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
  verified: "✓",
};

function Badges({ badges }: { badges: string[] }) {
  const shown = badges.filter((badge) => BADGE_LABEL[badge]).slice(0, 3);
  if (shown.length === 0) {
    return null;
  }
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

function Avatar({ name, url, size }: { name: string; url?: string | null; size: "alert" | "chat" }) {
  const [failed, setFailed] = useState(false);
  const className = `sko-avatar sko-avatar-${size}`;
  if (url && !failed) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={className} src={url} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
  }
  return (
    <span className={className} style={{ background: nameColor(name) }}>
      {name.replace(/^@/, "").charAt(0).toUpperCase()}
    </span>
  );
}
