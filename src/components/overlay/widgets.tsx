"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { MessagePart } from "@/lib/events/types";
import type { EmoteWallSettings, GoalSettings, LabelSettings, TickerSettings } from "@/lib/overlays/settings";
import { applyEvent, emptyStats, mergeYouTubeDays, metricValue, publicStats, type PublicStats, type StatAmount, type StatPerson, type StreamStats } from "@/lib/overlays/stats-core";
import { alertKindOf, matchesAlert, shortAction } from "./describe";
import type { OverlayEvent } from "./Overlays";

/**
 * Stats-driven widgets (goal bar, label) and the motion widgets (ticker, emote wall).
 * Test events (from the customizer or "Send test") count on top of the real stats in this
 * browser only, so streamers can see a goal move without a real follow. Served stats already
 * include YouTube support from the last 30 days in `total`; YouTube test events land in day
 * buckets, which are merged into `total` here.
 */
function useDisplayStats(stats: PublicStats | null, events: OverlayEvent[]) {
  return useMemo(() => {
    const display = structuredClone(stats ?? publicStats(emptyStats()));
    const working = display as unknown as StreamStats;
    working.youtubeDays = {};
    for (const event of events) {
      if (event.test) {
        applyEvent(working, event);
      }
    }
    mergeYouTubeDays(working);
    delete (working as Partial<StreamStats>).youtubeDays;
    return display;
  }, [stats, events]);
}

function useNow(everyMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(timer);
  }, [everyMs]);
  return now;
}

function money(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency, maximumFractionDigits: value % 1 === 0 ? 0 : 2 }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}

// ---- Goal -----------------------------------------------------------------------------------

export function GoalWidget({ settings: s, stats, events, overlayId }: { settings: GoalSettings; stats: PublicStats | null; events: OverlayEvent[]; overlayId: string }) {
  const display = useDisplayStats(stats, events);
  const now = useNow(60_000);
  const baseline = stats?.goals?.[overlayId];
  // Test events count on top; without a stored start (the preview, or a goal that hasn't started yet) only they count.
  const tested = metricValue(display.total, s.metric, s.currency) - (stats ? metricValue(stats.total, s.metric, s.currency) : 0);
  const counted = baseline && baseline.metric === s.metric ? (baseline.progress ?? 0) + tested : tested;
  const current = s.startValue + Math.max(0, counted);
  const percent = Math.min(100, Math.floor((current / Math.max(1, s.target)) * 100));
  const format = (value: number) => (s.metric === "tips" ? money(value, s.currency) : Math.floor(value).toLocaleString("en"));
  const numbers = `${format(current)} / ${format(s.target)}${s.showPercent ? ` (${percent}%)` : ""}`;
  const ends = s.endDate ? endsIn(s.endDate, now) : null;
  const style = {
    "--sko-bar": s.barColor,
    "--sko-bar-bg": s.barBackground,
    "--sko-bar-text": s.barTextColor,
    "--sko-bar-height": `${s.barHeight / 16}em`,
  } as CSSProperties;
  const fill = <div className="sko-goal-fill" style={{ width: `${percent}%` }} data-done={percent >= 100 || undefined} />;
  return (
    <div className="sko-goal" data-layout={s.layout} style={style}>
      {s.layout === "standard" ? (
        <>
          <div className="sko-goal-title">{s.title}</div>
          <div className="sko-goal-bar">
            {fill}
            <span className="sko-goal-numbers">{numbers}</span>
          </div>
          {ends ? <div className="sko-goal-end">{ends}</div> : null}
        </>
      ) : s.layout === "condensed" ? (
        <div className="sko-goal-bar">
          {fill}
          <span className="sko-goal-title">{s.title}</span>
          <span className="sko-goal-numbers">{numbers}</span>
        </div>
      ) : (
        <>
          <div className="sko-goal-line">
            <span className="sko-goal-title">{s.title}</span> <span className="sko-goal-numbers">{numbers}</span>
            {ends ? <span className="sko-goal-end"> · {ends}</span> : null}
          </div>
          <div className="sko-goal-bar" data-thin>
            {fill}
          </div>
        </>
      )}
    </div>
  );
}

function endsIn(date: string, now: number) {
  const end = Date.parse(`${date}T23:59:59`);
  if (!Number.isFinite(end)) {
    return null;
  }
  const days = Math.ceil((end - now) / 86_400_000);
  return days < 0 ? "Goal ended" : days === 0 ? "Ends today" : days === 1 ? "1 day left" : `${days} days left`;
}

// ---- Label ----------------------------------------------------------------------------------

type LabelValues = { name?: string; amount?: string; count?: string; list?: string };

function labelValues(s: LabelSettings, stats: PublicStats): LabelValues | null {
  const person = (p?: StatPerson) => (p ? { name: p.name } : null);
  const amount = (p?: StatAmount) => (p ? { name: p.name, amount: p.display || money(p.value, p.currency) } : null);
  const list = (items: { name: string; display?: string }[]) => (items.length ? { list: items.map((item) => (item.display ? `${item.name} ${item.display}` : item.name)).join(", ") } : null);
  const count = (value: number) => ({ count: value.toLocaleString("en") });
  const { latest, recent, session, total } = stats;
  switch (s.label) {
    case "latest_follower":
      return person(latest.follower);
    case "latest_subscriber":
      return latest.subscriber ? { name: latest.subscriber.name, count: String(latest.subscriber.months ?? 1) } : null;
    case "latest_gifter":
      return latest.gifter ? { name: latest.gifter.name, count: String(latest.gifter.count) } : null;
    case "latest_tip":
      return amount(latest.tip);
    case "latest_cheer":
      return amount(latest.cheer);
    case "latest_raid":
      return latest.raid ? { name: latest.raid.name, count: latest.raid.viewers.toLocaleString("en") } : null;
    case "latest_member":
      return person(latest.member);
    case "recent_followers":
      return list(recent.followers);
    case "recent_subscribers":
      return list(recent.subscribers);
    case "recent_tips":
      return list(recent.tips);
    case "recent_cheers":
      return list(recent.cheers);
    case "session_followers":
      return count(session.followers);
    case "session_subs":
      return count(session.subs);
    case "session_bits":
      return count(session.bits);
    case "session_tips":
      return { amount: money(session.tips[s.currency] ?? 0, s.currency) };
    case "session_top_tip":
      return amount(session.topTip);
    case "session_top_cheer":
      return amount(session.topCheer);
    case "session_top_gifter":
      return session.topGifter ? { name: session.topGifter.name, count: String(session.topGifter.count) } : null;
    case "total_followers":
      return count(total.followers);
    case "total_subs":
      return count(total.subs);
    case "total_bits":
      return count(total.bits);
    case "total_tips":
      return { amount: money(total.tips[s.currency] ?? 0, s.currency) };
    case "total_top_tip":
      return amount(total.topTip);
  }
}

export function LabelWidget({ settings: s, stats, events }: { settings: LabelSettings; stats: PublicStats | null; events: OverlayEvent[] }) {
  const display = useDisplayStats(stats, events);
  const values = labelValues(s, display);
  const text = values ? s.template.replace(/\{(name|amount|count|list)\}/g, (_, key: keyof LabelValues) => values[key] ?? "").trim() : s.emptyText;
  if (!text) {
    return null;
  }
  return (
    <div className="sko-label" data-align={s.align} data-scroll={s.scroll || undefined}>
      {s.scroll ? <Marquee speed={s.scrollSpeed}>{text}</Marquee> : <span className="sko-label-text">{text}</span>}
    </div>
  );
}

/** Content scrolling right to left forever at `speed` px/s, repeated so there's never a gap. */
function Marquee({ speed, children }: { speed: number; children: React.ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    const observer = new ResizeObserver(() => setWidth(element.offsetWidth));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <span className="sko-marquee" style={{ animationDuration: `${Math.max(2, width / speed)}s` }}>
      <span ref={ref} className="sko-marquee-copy">
        {children}
      </span>
      <span className="sko-marquee-copy" aria-hidden="true">
        {children}
      </span>
    </span>
  );
}

// ---- Ticker ---------------------------------------------------------------------------------

export function Ticker({ settings: s, events }: { settings: TickerSettings; events: OverlayEvent[] }) {
  const items = events.filter((event) => matchesAlert(event, s)).slice(-s.maxItems).reverse();
  if (items.length === 0) {
    return null;
  }
  return (
    <div className="sko-ticker">
      {s.title ? <span className="sko-ticker-title">{s.title}</span> : null}
      <div className="sko-ticker-track">
        <Marquee speed={s.speed}>
          {items.map((event) => {
            const { name, action, amount } = shortAction(event);
            return (
              <span key={event.id} className="sko-ticker-item">
                <span className="sko-ticker-name">{name}</span> {action}
                {amount ? <span className="sko-ticker-amount"> {amount}</span> : null}
                <span className="sko-ticker-sep">{s.separator}</span>
              </span>
            );
          })}
        </Marquee>
      </div>
    </div>
  );
}

// ---- Emote wall -----------------------------------------------------------------------------

type Sprite = { id: number; url?: string; emoji?: string; animation: string; style: CSSProperties };

const WALL_ANIMATIONS = ["rise", "bounce", "rain", "fountain", "zoom", "float"] as const;
/** Used for bursts before chat has shown any emotes: Twitch global emotes everyone knows. */
const FALLBACK_EMOTES = ["25", "425618", "30259", "64138", "58127"].map((id) => `https://static-cdn.jtvnw.net/emoticons/v2/${id}/static/dark/3.0`);
const EMOJI = /\p{Extended_Pictographic}/gu;

function emotesIn(parts: MessagePart[] | undefined, text: string | null, includeEmoji: boolean) {
  const found: { key: string; url?: string; emoji?: string }[] = [];
  for (const part of parts ?? []) {
    if (part.type === "emote" && !part.zeroWidth) {
      found.push({ key: part.url, url: part.url });
    } else if (part.type === "cheer") {
      found.push({ key: part.url, url: part.url });
    } else if (includeEmoji && part.type === "text") {
      found.push(...[...part.text.matchAll(EMOJI)].map((match) => ({ key: match[0], emoji: match[0] })));
    }
  }
  if (!parts && includeEmoji && text) {
    found.push(...[...text.matchAll(EMOJI)].map((match) => ({ key: match[0], emoji: match[0] })));
  }
  return found;
}

/** KappaGen-style wall: emotes from chat fly across the screen; subs, cheers and raids burst. */
export function EmoteWall({ settings: s, events }: { settings: EmoteWallSettings; events: OverlayEvent[] }) {
  const [sprites, setSprites] = useState<Sprite[]>([]);
  const handled = useRef(new Set<string>());
  const primed = useRef(false);
  const nextId = useRef(0);
  const combos = useRef(new Map<string, number[]>());
  const pool = useRef<string[]>([]);
  const settingsRef = useRef(s);
  useEffect(() => {
    settingsRef.current = s;
  }, [s]);

  useEffect(() => {
    const live = settingsRef.current;
    const spawned: Sprite[] = [];
    const make = (item: { url?: string; emoji?: string }, animation: string): Sprite => {
      const chosen = animation === "random" ? WALL_ANIMATIONS[Math.floor(Math.random() * WALL_ANIMATIONS.length)] : animation;
      const x = 5 + Math.random() * 90;
      return {
        id: nextId.current++,
        ...item,
        animation: chosen,
        style: {
          "--x": `${x}%`,
          "--y": `${10 + Math.random() * 70}%`,
          "--drift": `${(Math.random() - 0.5) * 8}em`,
          "--peak": `${5 + Math.random() * 35}%`,
          "--spin": `${(Math.random() - 0.5) * 720}deg`,
          // px (times the overlay's size), not em: the sprite sets its own font size for emoji.
          "--size": `calc(${live.emoteSize}px * var(--sk-scale, 1))`,
          "--dur": `${live.durationSec * (0.8 + Math.random() * 0.4)}s`,
          animationDelay: `${Math.random() * 0.2}s`,
        } as CSSProperties,
      };
    };
    for (const event of events) {
      if (handled.current.has(event.id)) {
        continue;
      }
      handled.current.add(event.id);
      if (!primed.current || !live.platforms[event.platform]) {
        continue;
      }
      if (event.kind === "chat.message") {
        const now = Date.now();
        const found = emotesIn(event.messageParts, event.message, live.includeEmoji).slice(0, live.perMessage);
        for (const item of found) {
          if (item.url && !pool.current.includes(item.url)) {
            pool.current = [item.url, ...pool.current].slice(0, 40);
          }
          const uses = (combos.current.get(item.key) ?? []).filter((at) => now - at < live.comboWindowSec * 1000);
          uses.push(now);
          combos.current.set(item.key, uses);
          if (uses.length >= live.comboMin) {
            spawned.push(make(item, live.animation));
          }
        }
        continue;
      }
      const kind = alertKindOf(event);
      if (kind && kind !== "redemption" && live.explodeOn[kind]) {
        const source = pool.current.length ? pool.current : FALLBACK_EMOTES;
        for (let n = 0; n < live.explodeCount; n += 1) {
          spawned.push(make({ url: source[n % source.length] }, "fountain"));
        }
      }
    }
    primed.current = true;
    if (spawned.length > 0) {
      setSprites((current) => [...current, ...spawned].slice(-live.maxOnScreen));
    }
  }, [events]);

  const remove = (id: number) => setSprites((current) => current.filter((sprite) => sprite.id !== id));
  return (
    <div className="sko-wall">
      {sprites.map((sprite) =>
        sprite.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={sprite.id} className="sko-sprite" data-anim={sprite.animation} style={sprite.style} src={sprite.url} alt="" referrerPolicy="no-referrer" onAnimationEnd={() => remove(sprite.id)} />
        ) : (
          <span key={sprite.id} className="sko-sprite" data-anim={sprite.animation} style={sprite.style} onAnimationEnd={() => remove(sprite.id)}>
            {sprite.emoji}
          </span>
        ),
      )}
    </div>
  );
}
