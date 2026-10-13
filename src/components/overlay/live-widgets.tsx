"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { PlatformLogo } from "@/components/dashboard/PlatformLogo";
import type { EventPlatform } from "@/lib/events/types";
import { wheelResult, wheelSegments, type PublicLiveTools } from "@/lib/live/types";
import { applyEvent, emptyStats, newBoss, publicStats, type PublicStats, type StreamStats } from "@/lib/overlays/stats-core";
import type {
  BossSettings,
  WheelSettings,
  CreditsSettings,
  GiveawaySettings,
  HighlightSettings,
  PollSettings,
  QueueSettings,
  TwitchActivitySettings,
  ViewersSettings,
} from "@/lib/overlays/settings";
import type { CreditsData, LiveSnapshot } from "@/lib/streams/summary";
import { MessageText } from "./MessageText";
import type { OverlayEvent } from "./Overlays";
import { AnimatedLetters, anim } from "./Overlays";

/**
 * Overlays for the live chat tools (poll, giveaway, queue, pinned message), the live stream
 * (viewer count, credits) and Twitch's own hype trains, polls and predictions.
 */

function useNow(everyMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(timer);
  }, [everyMs]);
  return now;
}

function clock(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

const barStyle = (color: string, background: string) => ({ "--sko-bar": color, "--sko-bar-bg": background }) as CSSProperties;

// ---- Chat poll ------------------------------------------------------------------------------

export function PollWidget({ settings: s, tools }: { settings: PollSettings; tools: PublicLiveTools | null }) {
  const now = useNow(1000);
  const poll = tools?.poll;
  if (!poll) {
    return null;
  }
  const closedAt = poll.status === "closed" ? Date.parse(poll.endsAt ?? poll.startedAt) : null;
  if (closedAt && s.resultSec > 0 && now - closedAt > s.resultSec * 1000) {
    return null;
  }
  const top = Math.max(...poll.options.map((option) => option.votes));
  return (
    <div className="sko-box sko-poll" style={barStyle(s.barColor, s.barBackground)}>
      <div className="sko-box-head">
        <span className="sko-box-title">{poll.question}</span>
        <span className="sko-box-meta">{poll.status === "open" ? (poll.endsAt ? clock(Date.parse(poll.endsAt) - now) : "Voting open") : "Final results"}</span>
      </div>
      <div className="sko-poll-options">
        {poll.options.map((option, index) => {
          const percent = poll.totalVotes ? Math.round((option.votes / poll.totalVotes) * 100) : 0;
          const winning = poll.status === "closed" && option.votes === top && top > 0;
          return (
            <div key={index} className="sko-poll-option" data-winning={winning || undefined}>
              <div className="sko-poll-bar">
                <div className="sko-poll-fill" style={{ width: `${percent}%` }} />
                <span className="sko-poll-label">
                  <span className="sko-poll-number">{index + 1}</span> {option.label}
                </span>
                <span className="sko-poll-value">
                  {[s.showPercent ? `${percent}%` : null, s.showVotes ? option.votes.toLocaleString("en") : null].filter(Boolean).join(" · ")}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="sko-box-foot">
        {poll.status === "open" ? <span>{s.instructions}</span> : <span />}
        <span>{`${poll.totalVotes.toLocaleString("en")} vote${poll.totalVotes === 1 ? "" : "s"}`}</span>
      </div>
    </div>
  );
}

// ---- Giveaway -------------------------------------------------------------------------------

export function GiveawayWidget({ settings: s, tools }: { settings: GiveawaySettings; tools: PublicLiveTools | null }) {
  const giveaway = tools?.giveaway;
  const winner = giveaway?.winners.at(-1) ?? null;
  const winnerKey = winner ? `${winner.key}@${winner.at}` : null;
  const [revealing, setRevealing] = useState<string | null>(null);
  const seen = useRef<string | null>(winnerKey);
  const settingsRef = useRef(s);
  useEffect(() => {
    settingsRef.current = s;
  }, [s]);

  // A new winner: spin through the entrants for a moment, then reveal (with a fanfare).
  useEffect(() => {
    if (!winnerKey || winnerKey === seen.current) {
      return;
    }
    seen.current = winnerKey;
    const start = setTimeout(() => setRevealing(winnerKey), 0);
    const stop = setTimeout(() => {
      setRevealing(null);
      if (settingsRef.current.sound) {
        const audio = new Audio("/library/sounds/jingles/sax-victory.mp3");
        audio.volume = settingsRef.current.volume;
        void audio.play().catch(() => {});
      }
    }, 2600);
    return () => {
      clearTimeout(start);
      clearTimeout(stop);
    };
  }, [winnerKey]);

  if (!giveaway) {
    return null;
  }
  const reel = giveaway.recent.length ? giveaway.recent : [{ key: "-", name: "…", platform: "twitch" as EventPlatform }];
  return (
    <div className="sko-box sko-giveaway">
      <div className="sko-box-head">
        <span className="sko-box-title">{giveaway.title}</span>
        {s.showEntries ? <span className="sko-box-meta">{`${giveaway.entries.toLocaleString("en")} entr${giveaway.entries === 1 ? "y" : "ies"}`}</span> : null}
      </div>
      {revealing ? (
        <div className="sko-giveaway-reel">
          <div className="sko-giveaway-reel-track">
            {[...reel, ...reel, ...reel].map((person, index) => (
              <span key={index}>{person.name}</span>
            ))}
          </div>
        </div>
      ) : winner && giveaway.status === "closed" ? (
        <div className="sko-giveaway-winner" key={winnerKey}>
          <span className="sko-giveaway-label">Winner</span>
          <span className="sko-giveaway-name">
            <PlatformLogo platform={winner.platform} size={22} /> <AnimatedLetters text={winner.name} animation="tada" />
          </span>
        </div>
      ) : (
        <div className="sko-giveaway-open">
          <span className="sko-giveaway-cta">{s.instructions.replace("{keyword}", giveaway.keyword)}</span>
          <span className="sko-giveaway-recent">
            {giveaway.recent.slice(0, 4).map((person) => (
              <span key={person.key} className="sko-anim-fadeInUp">
                {person.name}
              </span>
            ))}
          </span>
          {giveaway.status === "closed" ? <span className="sko-box-meta">Entries closed</span> : null}
        </div>
      )}
    </div>
  );
}

// ---- Viewer queue ---------------------------------------------------------------------------

export function QueueWidget({ settings: s, tools }: { settings: QueueSettings; tools: PublicLiveTools | null }) {
  const queue = tools?.queue;
  if (!queue || (s.hideWhenClosed && !queue.open) || (!queue.open && !queue.current && queue.entries.length === 0)) {
    return null;
  }
  const shown = queue.entries.slice(0, s.maxShown);
  return (
    <div className="sko-box sko-queue">
      <div className="sko-box-head">
        <span className="sko-box-title">{queue.title}</span>
        <span className="sko-box-meta">{queue.open ? `${queue.entries.length} waiting` : "Closed"}</span>
      </div>
      {queue.current ? (
        <div className="sko-queue-current">
          <span className="sko-queue-label">Now</span>
          {s.showPlatform ? <PlatformLogo platform={queue.current.platform} size={14} /> : null}
          <span className="sko-queue-name">{queue.current.name}</span>
        </div>
      ) : null}
      <ol className="sko-queue-list">
        {shown.map((entry, index) => (
          <li key={entry.key} className="sko-anim-fadeInRight">
            <span className="sko-queue-pos">{index + 1}</span>
            {s.showPlatform ? <PlatformLogo platform={entry.platform} size={13} /> : null}
            <span className="sko-queue-name">{entry.name}</span>
          </li>
        ))}
      </ol>
      {queue.entries.length > shown.length ? <div className="sko-box-meta">{`+${queue.entries.length - shown.length} more`}</div> : null}
      {queue.open ? <div className="sko-box-foot">{s.instructions}</div> : null}
    </div>
  );
}

// ---- Chat highlight -------------------------------------------------------------------------

export function HighlightWidget({ settings: s, tools }: { settings: HighlightSettings; tools: PublicLiveTools | null }) {
  const now = useNow(1000);
  const highlight = tools?.highlight;
  if (!highlight || (s.autoHideSec > 0 && now - Date.parse(highlight.at) > s.autoHideSec * 1000)) {
    return null;
  }
  return (
    <div key={`${highlight.id}@${highlight.at}`} className={`sko-highlight ${anim(s.animation)}`}>
      {s.showAvatar ? (
        highlight.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="sko-highlight-avatar" src={highlight.avatarUrl} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span className="sko-highlight-avatar">{highlight.name.charAt(0).toUpperCase()}</span>
        )
      ) : null}
      <div className="sko-highlight-body">
        <div className="sko-highlight-name" style={highlight.color ? { color: highlight.color } : undefined}>
          {s.showPlatform ? <PlatformLogo platform={highlight.platform} size={16} /> : null}
          <span>{highlight.name}</span>
        </div>
        <MessageText className="sko-highlight-text" text={highlight.message} parts={highlight.messageParts} />
      </div>
    </div>
  );
}

// ---- Viewer count ---------------------------------------------------------------------------

export function ViewersWidget({ settings: s, stream }: { settings: ViewersSettings; stream: LiveSnapshot | null }) {
  const now = useNow(1000);
  const viewers = stream?.viewers ?? {};
  const total = Object.values(viewers).reduce((sum, value) => sum + (value ?? 0), 0);
  const live = Boolean(stream?.live);
  return (
    <div className="sko-viewers" data-align={s.align} data-live={live || undefined}>
      {s.showLiveDot ? <span className="sko-viewers-dot" /> : null}
      {s.mode === "split" && live ? (
        (Object.entries(viewers) as [EventPlatform, number][]).map(([platform, value]) => (
          <span key={platform} className="sko-viewers-part">
            <PlatformLogo platform={platform} size={18} />
            <span className="sko-viewers-count">{value.toLocaleString("en")}</span>
          </span>
        ))
      ) : (
        <span className="sko-viewers-count">{live ? total.toLocaleString("en") : "Offline"}</span>
      )}
      {live && s.label ? <span className="sko-viewers-label">{s.label}</span> : null}
      {live && s.showUptime && stream?.startedAt ? <span className="sko-viewers-uptime">{clock(now - Date.parse(stream.startedAt))}</span> : null}
    </div>
  );
}

// ---- Credits --------------------------------------------------------------------------------

export function CreditsWidget({ settings: s, credits }: { settings: CreditsSettings; credits: CreditsData | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    const observer = new ResizeObserver(() => setHeight(element.offsetHeight));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const sections: { title: string; names: string[] }[] = credits
    ? [
        s.sections.followers ? { title: "New followers", names: credits.followers } : null,
        s.sections.subscribers ? { title: "Subscribers", names: credits.subscribers } : null,
        s.sections.gifters ? { title: "Gifted subs", names: credits.gifters.map((g) => `${g.name} ×${g.count}`) } : null,
        s.sections.cheers ? { title: "Cheers", names: credits.cheers.map((c) => `${c.name} · ${c.amount}`) } : null,
        s.sections.tips ? { title: "Tips", names: credits.tips.map((t) => `${t.name} · ${t.amount}`) } : null,
        s.sections.raiders ? { title: "Raiders", names: credits.raiders.map((r) => `${r.name} · ${r.viewers}`) } : null,
        s.sections.chatters ? { title: "Chat", names: credits.chatters } : null,
      ].filter((section): section is { title: string; names: string[] } => Boolean(section && section.names.length))
    : [];
  // Roll from just below the screen to just above it.
  const duration = Math.max(8, (height + 1080) / s.speed);
  return (
    <div className="sko-credits">
      <div ref={ref} className="sko-credits-roll" style={{ animationDuration: `${duration}s`, animationIterationCount: s.loop ? "infinite" : 1 }}>
        <div className="sko-credits-title">{s.title}</div>
        {credits?.streamTitle ? <div className="sko-credits-sub">{credits.streamTitle}</div> : null}
        {sections.map((section) => (
          <div key={section.title} className="sko-credits-section">
            <div className="sko-credits-heading">{section.title}</div>
            <div className="sko-credits-names">
              {section.names.map((name, index) => (
                <span key={index}>{name}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Twitch activity ------------------------------------------------------------------------

type Choice = { title?: string; votes?: number; channel_points_votes?: number; bits_votes?: number };
type Outcome = { title?: string; color?: string; users?: number; channel_points?: number };

/** The latest of each Twitch activity that's still running (or ended in the last 20 seconds). */
export function TwitchActivityWidget({ settings: s, events }: { settings: TwitchActivitySettings; events: OverlayEvent[] }) {
  const now = useNow(1000);
  const latest = (kind: string) => [...events].reverse().find((event) => event.kind === kind && event.platform === "twitch");
  const active = (event: OverlayEvent | undefined) => event && (event.data?.phase !== "end" || now - (event.seenAt ?? Date.parse(event.receivedAt)) < 20_000);
  const train = s.showHypeTrain ? latest("hype_train") : undefined;
  const poll = s.showPolls ? latest("poll") : undefined;
  const prediction = s.showPredictions ? latest("prediction") : undefined;
  const style = barStyle(s.barColor, s.barBackground);
  return (
    <div className="sko-twitch" style={style}>
      {active(train) && train ? (
        <div className="sko-box sko-anim-fadeInDown">
          <div className="sko-box-head">
            <span className="sko-box-title">{`Hype Train · Level ${Number(train.data.level ?? 1)}`}</span>
            <span className="sko-box-meta">{train.data.phase === "end" ? "Complete!" : `${Math.min(100, Math.round((Number(train.data.total ?? 0) / Math.max(1, Number(train.data.goal ?? 1))) * 100))}%`}</span>
          </div>
          <div className="sko-poll-bar">
            <div className="sko-poll-fill" style={{ width: `${Math.min(100, (Number(train.data.total ?? 0) / Math.max(1, Number(train.data.goal ?? 1))) * 100)}%` }} />
          </div>
        </div>
      ) : null}
      {active(poll) && poll ? (
        <TwitchChoices
          title={String(poll.data.title ?? "Poll")}
          meta={poll.data.phase === "end" ? "Final results" : "Twitch poll"}
          rows={((poll.data.choices as Choice[]) ?? []).map((choice) => ({ label: choice.title ?? "", value: Number(choice.votes ?? (choice.channel_points_votes ?? 0) + (choice.bits_votes ?? 0)) }))}
          unit="votes"
        />
      ) : null}
      {active(prediction) && prediction ? (
        <TwitchChoices
          title={String(prediction.data.title ?? "Prediction")}
          meta={prediction.data.phase === "lock" ? "Locked" : prediction.data.phase === "end" ? "Resolved" : "Prediction"}
          rows={((prediction.data.outcomes as Outcome[]) ?? []).map((outcome) => ({
            label: outcome.title ?? "",
            value: Number(outcome.channel_points ?? 0),
            color: outcome.color === "pink" ? "#f5009b" : outcome.color === "blue" ? "#387aff" : undefined,
          }))}
          unit="points"
        />
      ) : null}
    </div>
  );
}

function TwitchChoices({ title, meta, rows, unit }: { title: string; meta: string; rows: { label: string; value: number; color?: string }[]; unit: string }) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  return (
    <div className="sko-box sko-anim-fadeInDown">
      <div className="sko-box-head">
        <span className="sko-box-title">{title}</span>
        <span className="sko-box-meta">{meta}</span>
      </div>
      <div className="sko-poll-options">
        {rows.map((row, index) => {
          const percent = total ? Math.round((row.value / total) * 100) : 0;
          return (
            <div key={index} className="sko-poll-bar">
              <div className="sko-poll-fill" style={{ width: `${percent}%`, ...(row.color ? { background: row.color } : {}) }} />
              <span className="sko-poll-label">{row.label}</span>
              <span className="sko-poll-value">{`${percent}% · ${row.value.toLocaleString("en")} ${unit}`}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- Spin wheel -----------------------------------------------------------------------------

const WHEEL_COLORS = ["var(--sko-accent)", "#ff6b6b", "#ffd93d", "#6bcB77", "#4d96ff", "#c77dff", "#ff9f43", "#2ec4b6"];

function hashSeed(text: string) {
  let hash = 0;
  for (const char of text) {
    hash = (hash * 31 + char.charCodeAt(0)) | 0;
  }
  return Math.abs(hash);
}

/**
 * A wheel that spins to a segment chosen by the spin's seed (so the dashboard knows the result
 * too). Spins come from Live tools or from a matching channel point redemption.
 */
export function WheelWidget({ settings: s, tools, events, preview }: { settings: WheelSettings; tools: PublicLiveTools | null; events: OverlayEvent[]; preview: boolean }) {
  const segments = wheelSegments(s.segments);
  const [mountedAt] = useState(() => Date.now());
  const redemption = s.redemption.trim().toLowerCase();
  const local = redemption
    ? [...events].reverse().find((event) => event.kind === "redemption" && String((event.data?.reward as { title?: string } | undefined)?.title ?? "").trim().toLowerCase() === redemption)
    : undefined;
  const candidates = [tools?.wheel ?? null, local ? { id: local.id, seed: hashSeed(local.id), at: new Date(local.seenAt ?? Date.parse(local.receivedAt)).toISOString() } : null].filter(
    (spin): spin is NonNullable<typeof spin> => Boolean(spin) && Date.parse(spin!.at) > mountedAt - 3000,
  );
  const spin = candidates.sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0] ?? null;

  const [view, setView] = useState<{ id: string | null; rotation: number; phase: "idle" | "spinning" | "result"; index: number }>({ id: null, rotation: 0, phase: "idle", index: 0 });
  const settingsRef = useRef(s);
  useEffect(() => {
    settingsRef.current = s;
  }, [s]);

  useEffect(() => {
    if (!spin || spin.id === view.id || segments.length === 0) {
      return;
    }
    const live = settingsRef.current;
    const index = wheelResult(spin.seed, segments.length);
    const slice = 360 / segments.length;
    const center = (index + 0.5) * slice;
    const base = view.rotation + 360 * 6;
    const rotation = base + ((((360 - center - (base % 360)) % 360) + 360) % 360);
    const play = (file: string) => {
      if (live.sound) {
        const audio = new Audio(file);
        audio.volume = live.volume;
        void audio.play().catch(() => {});
      }
    };
    const start = setTimeout(() => {
      setView({ id: spin.id, rotation, phase: "spinning", index });
      play("/library/sounds/hype/rising-sweep.mp3");
    }, 0);
    const done = setTimeout(() => {
      setView((current) => (current.id === spin.id ? { ...current, phase: "result" } : current));
      play("/library/sounds/jingles/pizzicato-tada.mp3");
    }, live.spinSec * 1000 + 50);
    const hide = live.resultSec > 0 ? setTimeout(() => setView((current) => (current.id === spin.id ? { ...current, phase: "idle" } : current)), (live.spinSec + live.resultSec) * 1000) : undefined;
    return () => {
      clearTimeout(start);
      clearTimeout(done);
      clearTimeout(hide);
    };
    // Only a new spin should start the animation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spin?.id]);

  if (segments.length === 0 || (view.phase === "idle" && s.resultSec > 0 && !preview)) {
    return null;
  }
  const slice = 360 / segments.length;
  const r = 280;
  const point = (angle: number, radius = r) => {
    const rad = ((angle - 90) * Math.PI) / 180;
    return `${300 + radius * Math.cos(rad)} ${300 + radius * Math.sin(rad)}`;
  };
  return (
    <div className="sko-wheel">
      <div className="sko-wheel-pointer" />
      <svg
        viewBox="0 0 600 600"
        className="sko-wheel-disc"
        style={{ transform: `rotate(${view.rotation}deg)`, transitionDuration: view.phase === "spinning" ? `${s.spinSec}s` : "0s" }}
      >
        {segments.map((label, index) => {
          const from = index * slice;
          const to = from + slice;
          const path = segments.length === 1 ? `M 300 20 A 280 280 0 1 1 299.9 20 Z` : `M 300 300 L ${point(from)} A ${r} ${r} 0 ${slice > 180 ? 1 : 0} 1 ${point(to)} Z`;
          return (
            <g key={index}>
              <path d={path} fill={WHEEL_COLORS[index % WHEEL_COLORS.length]} stroke="rgb(0 0 0 / 35%)" strokeWidth={2} />
              <text
                x={300}
                y={300 - r * 0.6}
                transform={`rotate(${from + slice / 2} 300 300)`}
                textAnchor="middle"
                dominantBaseline="middle"
                className="sko-wheel-label"
                style={{ fontSize: Math.max(13, Math.min(30, 320 / segments.length + 6)) }}
              >
                {label.length > 22 ? `${label.slice(0, 21)}…` : label}
              </text>
            </g>
          );
        })}
        <circle cx={300} cy={300} r={34} className="sko-wheel-hub" />
      </svg>
      {view.phase === "result" ? (
        <div className="sko-wheel-result sko-anim-zoomIn">
          <AnimatedLetters text={segments[view.index] ?? ""} animation="tada" />
        </div>
      ) : null}
    </div>
  );
}

// ---- Stream boss ----------------------------------------------------------------------------

export function BossWidget({ settings: s, stats, events }: { settings: BossSettings; stats: PublicStats | null; events: OverlayEvent[] }) {
  const display = useMemo(() => {
    const copy = structuredClone(stats ?? publicStats(emptyStats()));
    for (const event of events) {
      if (event.test) {
        applyEvent(copy as unknown as StreamStats, event);
      }
    }
    return copy;
  }, [stats, events]);
  const now = useNow(1000);
  const boss = display.boss ?? newBoss();
  const percent = Math.max(0, Math.min(100, (boss.hp / boss.maxHp) * 100));
  const recentHit = boss.lastHit && now - Date.parse(boss.lastHit.at) < 8000 ? boss.lastHit : null;
  return (
    <div className="sko-box sko-boss" style={barStyle(s.barColor, s.barBackground)}>
      <div className="sko-box-head">
        <span className="sko-box-title">{s.title}</span>
        {recentHit ? <span key={recentHit.at} className="sko-boss-hit sko-anim-fadeInUp">{`−${recentHit.damage} ${recentHit.name} ${recentHit.what}`}</span> : null}
      </div>
      <div className="sko-boss-row">
        {s.showAvatar ? (
          boss.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="sko-boss-avatar" src={boss.avatarUrl} alt="" referrerPolicy="no-referrer" />
          ) : (
            <span className="sko-boss-avatar">{boss.name.charAt(0).toUpperCase()}</span>
          )
        ) : null}
        <div className="sko-boss-body">
          <span className="sko-boss-name">
            {boss.platform ? <PlatformLogo platform={boss.platform} size={16} /> : null} {boss.name}
          </span>
          <div className="sko-poll-bar">
            <div className="sko-poll-fill" style={{ width: `${percent}%` }} />
            <span className="sko-poll-label" />
            <span className="sko-poll-value">{`${Math.max(0, boss.hp).toLocaleString("en")} / ${boss.maxHp.toLocaleString("en")} HP`}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
