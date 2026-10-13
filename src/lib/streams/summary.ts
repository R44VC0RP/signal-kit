import type { EventPlatform, SignalKitEvent } from "@/lib/events/types";

/**
 * What Signal Kit remembers about a stream. Built up live from events and viewer samples,
 * because raw events are deleted after 24 hours. Pure: no server imports, so the dashboard
 * can format it and later recap emails can reuse it.
 */

export type PlatformStats = {
  connectionId: string;
  live: boolean;
  startedAt: string;
  endedAt: string | null;
  title: string | null;
  category: string | null;
  /** YouTube video id / X broadcast id, for viewer polling and links. */
  broadcastId: string | null;
  peakViewers: number;
  viewerSum: number;
  viewerSamples: number;
  messages: number;
  chatters: number;
  /** First time ever chatting on this creator's streams. */
  newChatters: number;
  follows: number;
  subs: number;
  giftedSubs: number;
  bits: number;
  tips: Record<string, number>;
  raids: number;
  raidViewers: number;
  redemptions: number;
};

/** One minute of the stream: chat messages and viewers per platform. */
export type TimelinePoint = { m: Partial<Record<EventPlatform, number>>; v: Partial<Record<EventPlatform, number>> };

export type Supporter = { name: string; platform: EventPlatform; bits: number; tips: Record<string, number>; gifts: number; subs: number };

export type Highlight = { at: string; kind: string; platform: EventPlatform; name: string; detail: string | null };

export type StreamSummary = {
  platforms: Partial<Record<EventPlatform, PlatformStats>>;
  /** Index = minutes since the stream started. */
  timeline: TimelinePoint[];
  supporters: Record<string, Supporter>;
  highlights: Highlight[];
};

const MAX_HIGHLIGHTS = 500;
/** Supporters kept once a stream ends (all are kept while live). */
export const TOP_SUPPORTERS = 25;

export function emptySummary(): StreamSummary {
  return { platforms: {}, timeline: [], supporters: {}, highlights: [] };
}

export function emptyPlatform(connectionId: string, startedAt: string): PlatformStats {
  return {
    connectionId,
    live: true,
    startedAt,
    endedAt: null,
    title: null,
    category: null,
    broadcastId: null,
    peakViewers: 0,
    viewerSum: 0,
    viewerSamples: 0,
    messages: 0,
    chatters: 0,
    newChatters: 0,
    follows: 0,
    subs: 0,
    giftedSubs: 0,
    bits: 0,
    tips: {},
    raids: 0,
    raidViewers: 0,
    redemptions: 0,
  };
}

/** The timeline minute for a moment in the stream, created (with any gap) when missing. */
export function minute(summary: StreamSummary, startedAt: string, at: number) {
  const index = Math.max(0, Math.floor((at - Date.parse(startedAt)) / 60_000));
  // A day-long stream is 1,440 points; cap so a stuck stream can't grow forever.
  if (index > 2880) {
    return null;
  }
  while (summary.timeline.length <= index) {
    summary.timeline.push({ m: {}, v: {} });
  }
  return summary.timeline[index];
}

/** Counts one event (not chat; chatters are tracked separately) into the stream's summary. */
export function countEvent(summary: StreamSummary, event: SignalKitEvent) {
  const stats = summary.platforms[event.platform];
  if (!stats) {
    return false;
  }
  const data = event.data ?? {};
  const name = event.actor?.name || "Anonymous";
  const supporter = () => (summary.supporters[`${event.platform}:${name.toLowerCase()}`] ??= { name, platform: event.platform, bits: 0, tips: {}, gifts: 0, subs: 0 });
  let detail: string | null = null;
  switch (event.kind) {
    case "follow":
      stats.follows += 1;
      break;
    case "subscription":
      // Twitch also sends each gift's recipients as subscriptions; the gift already counted them.
      if (event.platform === "twitch" && data.isGift === true) {
        return false;
      }
      stats.subs += 1;
      supporter().subs += 1;
      detail = typeof data.months === "number" && data.months > 1 ? `${data.months} months` : null;
      break;
    case "subscription.gift": {
      const count = typeof data.count === "number" && data.count > 0 ? data.count : 1;
      stats.subs += count;
      stats.giftedSubs += count;
      supporter().gifts += count;
      detail = `${count} gifted`;
      break;
    }
    case "tip": {
      const amount = event.amount;
      if (!amount || !(amount.value > 0)) {
        return false;
      }
      if (amount.currency === "BITS") {
        stats.bits += amount.value;
        supporter().bits += amount.value;
      } else {
        const currency = amount.currency.toUpperCase();
        stats.tips[currency] = round2((stats.tips[currency] ?? 0) + amount.value);
        const s = supporter();
        s.tips[currency] = round2((s.tips[currency] ?? 0) + amount.value);
      }
      detail = amount.display;
      break;
    }
    case "raid": {
      const viewers = Number(data.viewers ?? 0) || 0;
      stats.raids += 1;
      stats.raidViewers += viewers;
      detail = `${viewers.toLocaleString("en")} viewers`;
      break;
    }
    case "redemption":
      stats.redemptions += 1;
      detail = (data.reward as { title?: string } | undefined)?.title ?? null;
      break;
    default:
      return false;
  }
  if (summary.highlights.length < MAX_HIGHLIGHTS) {
    summary.highlights.push({ at: event.occurredAt, kind: event.kind, platform: event.platform, name, detail });
  }
  return true;
}

/** Records a viewer count sample for a platform. */
export function sampleViewers(summary: StreamSummary, startedAt: string, platform: EventPlatform, viewers: number, at = Date.now()) {
  const stats = summary.platforms[platform];
  if (!stats || !Number.isFinite(viewers) || viewers < 0) {
    return;
  }
  stats.peakViewers = Math.max(stats.peakViewers, viewers);
  stats.viewerSum += viewers;
  stats.viewerSamples += 1;
  const point = minute(summary, startedAt, at);
  if (point) {
    point.v[platform] = viewers;
  }
}

/** Keeps the biggest supporters once a stream is over. */
export function trimSupporters(summary: StreamSummary) {
  const ranked = Object.entries(summary.supporters).sort(([, a], [, b]) => supportScore(b) - supportScore(a));
  summary.supporters = Object.fromEntries(ranked.slice(0, TOP_SUPPORTERS));
}

/** Rough ranking: a gifted sub ≈ $5, 100 bits ≈ $1, other currencies counted at face value. */
export function supportScore(s: Supporter) {
  return s.gifts * 5 + s.subs * 5 + s.bits / 100 + Object.values(s.tips).reduce((sum, value) => sum + value, 0);
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

// ---- Totals for display ---------------------------------------------------------------------

export type StreamTotals = {
  peakViewers: number;
  avgViewers: number;
  chatters: number;
  newChatters: number;
  messages: number;
  follows: number;
  subs: number;
  giftedSubs: number;
  bits: number;
  tips: Record<string, number>;
  raids: number;
};

/** Sums platforms. Peak and average viewers add up across platforms (a simulcast's combined audience). */
export function totals(summary: StreamSummary): StreamTotals {
  const all = Object.values(summary.platforms);
  const sum = (pick: (p: PlatformStats) => number) => all.reduce((total, p) => total + pick(p), 0);
  const tips: Record<string, number> = {};
  for (const p of all) {
    for (const [currency, value] of Object.entries(p.tips)) {
      tips[currency] = round2((tips[currency] ?? 0) + value);
    }
  }
  // Combined peak: the busiest minute across platforms, not the sum of each platform's own peak.
  const combinedPeak = summary.timeline.reduce((max, point) => Math.max(max, Object.values(point.v).reduce((a, b) => a + (b ?? 0), 0)), 0);
  return {
    peakViewers: Math.max(combinedPeak, ...all.map((p) => p.peakViewers), 0),
    avgViewers: Math.round(sum((p) => (p.viewerSamples ? p.viewerSum / p.viewerSamples : 0))),
    chatters: sum((p) => p.chatters),
    newChatters: sum((p) => p.newChatters),
    messages: sum((p) => p.messages),
    follows: sum((p) => p.follows),
    subs: sum((p) => p.subs),
    giftedSubs: sum((p) => p.giftedSubs),
    bits: sum((p) => p.bits),
    tips,
    raids: sum((p) => p.raids),
  };
}
