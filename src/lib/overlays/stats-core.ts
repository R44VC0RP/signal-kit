import type { EventPlatform, SignalKitEvent } from "@/lib/events/types";

/**
 * Running tallies per streamer behind goal bars and labels (latest follower, session subs, top
 * tip…). Updated as events are ingested, pushed live to open overlays, and stored so a restart
 * or a new OBS scene shows the same numbers. "session" restarts when a stream goes live;
 * "total" counts since Signal Kit started tracking.
 *
 * This file is pure (no server imports) so overlays and the studio preview can apply events too.
 */

export type StatPerson = { name: string; platform: EventPlatform; avatarUrl?: string | null; at: string };
export type StatAmount = StatPerson & { value: number; display: string; currency: string };

/** Metrics a goal can track; tips and Super Chats are tracked per currency. */
export const STAT_METRICS = ["followers", "subs", "gifts", "bits", "tips", "members", "raids"] as const;
export type StatMetric = (typeof STAT_METRICS)[number];

export type Counters = {
  followers: number;
  /** Paid subs and memberships, including gifted ones. */
  subs: number;
  /** Gifted subs and memberships. */
  gifts: number;
  bits: number;
  /** Money tips and Super Chats, per ISO currency. */
  tips: Record<string, number>;
  /** YouTube memberships (also counted in subs). */
  members: number;
  raids: number;
  tipCount: number;
};

export type GoalBaseline = { metric: StatMetric; currency: string; value: number; at: string };

export type StreamStats = {
  latest: {
    follower?: StatPerson;
    subscriber?: StatPerson & { months?: number; tier?: string };
    gifter?: StatPerson & { count: number };
    tip?: StatAmount;
    cheer?: StatAmount;
    raid?: StatPerson & { viewers: number };
    member?: StatPerson;
  };
  /** Most recent first, up to 10 each. */
  recent: { followers: StatPerson[]; subscribers: StatPerson[]; tips: StatAmount[]; cheers: StatAmount[] };
  session: Counters & { startedAt: string; topTip?: StatAmount; topCheer?: StatAmount; topGifter?: StatPerson & { count: number } };
  total: Counters & { topTip?: StatAmount; topCheer?: StatAmount };
  /** Goal overlays count from here: the metric's total when the goal was (re)started. */
  goalBaselines: Record<string, GoalBaseline>;
};

const RECENT = 10;
/** A second platform going live soon after the first shouldn't restart the session. */
const SESSION_RESTART_GAP_MS = 15 * 60 * 1000;

export function emptyCounters(): Counters {
  return { followers: 0, subs: 0, gifts: 0, bits: 0, tips: {}, members: 0, raids: 0, tipCount: 0 };
}

export function emptyStats(now = new Date()): StreamStats {
  return {
    latest: {},
    recent: { followers: [], subscribers: [], tips: [], cheers: [] },
    session: { ...emptyCounters(), startedAt: now.toISOString() },
    total: emptyCounters(),
    goalBaselines: {},
  };
}

/** Value of one metric in a set of counters; tips use the given currency. */
export function metricValue(counters: Counters, metric: StatMetric, currency = "USD") {
  if (metric === "tips") {
    return counters.tips[currency.toUpperCase()] ?? 0;
  }
  return counters[metric];
}

/** What overlays get: everything but the goal bookkeeping. */
export function publicStats(stats: StreamStats) {
  const { goalBaselines, ...rest } = stats;
  return { ...rest, goals: goalBaselines };
}
export type PublicStats = ReturnType<typeof publicStats>;

/** Mutates `stats` for the event; returns whether anything changed. Pure, so it's easy to reason about. */
export function applyEvent(stats: StreamStats, event: SignalKitEvent): boolean {
  const at = event.occurredAt;
  const person: StatPerson | null = event.actor ? { name: event.actor.name || "Someone", platform: event.platform, avatarUrl: event.actor.avatarUrl ?? null, at } : null;
  const both = [stats.session, stats.total];
  const data = event.data ?? {};

  switch (event.kind) {
    case "stream.online": {
      const started = Date.parse(stats.session.startedAt) || 0;
      if (Date.now() - started < SESSION_RESTART_GAP_MS && sessionIsEmpty(stats.session)) {
        return false;
      }
      stats.session = { ...emptyCounters(), startedAt: new Date().toISOString() };
      return true;
    }
    case "follow":
      if (!person) {
        return false;
      }
      both.forEach((c) => (c.followers += 1));
      stats.latest.follower = person;
      stats.recent.followers = [person, ...stats.recent.followers].slice(0, RECENT);
      return true;
    case "subscription": {
      // Twitch also sends a gift's recipients as subscriptions; the gift event already counted them.
      const giftedOnTwitch = event.platform === "twitch" && data.isGift === true;
      if (!giftedOnTwitch) {
        both.forEach((c) => (c.subs += 1));
        if (event.platform === "youtube") {
          both.forEach((c) => (c.members += 1));
        }
      }
      if (person) {
        const sub = { ...person, months: typeof data.months === "number" ? data.months : undefined, tier: typeof data.tier === "string" ? data.tier : undefined };
        stats.latest.subscriber = sub;
        stats.recent.subscribers = [sub, ...stats.recent.subscribers].slice(0, RECENT);
        if (event.platform === "youtube") {
          stats.latest.member = person;
        }
      }
      return true;
    }
    case "subscription.gift": {
      const count = typeof data.count === "number" && data.count > 0 ? data.count : 1;
      both.forEach((c) => {
        c.subs += count;
        c.gifts += count;
        if (event.platform === "youtube") {
          c.members += count;
        }
      });
      if (person && data.anonymous !== true) {
        stats.latest.gifter = { ...person, count };
        const top = stats.session.topGifter;
        // Session top gifter: biggest single gift (lifetime per-user sums need history we don't keep).
        if (!top || count > top.count) {
          stats.session.topGifter = { ...person, count };
        }
      }
      return true;
    }
    case "tip": {
      const amount = event.amount;
      if (!amount || !(amount.value > 0)) {
        return false;
      }
      const entry: StatAmount = { ...(person ?? { name: "Anonymous", platform: event.platform, at }), value: amount.value, display: amount.display, currency: amount.currency };
      if (amount.currency === "BITS") {
        both.forEach((c) => (c.bits += amount.value));
        stats.latest.cheer = entry;
        stats.recent.cheers = [entry, ...stats.recent.cheers].slice(0, RECENT);
        if (!stats.session.topCheer || amount.value > stats.session.topCheer.value) stats.session.topCheer = entry;
        if (!stats.total.topCheer || amount.value > stats.total.topCheer.value) stats.total.topCheer = entry;
        return true;
      }
      const currency = amount.currency.toUpperCase();
      both.forEach((c) => {
        c.tips[currency] = round2((c.tips[currency] ?? 0) + amount.value);
        c.tipCount += 1;
      });
      stats.latest.tip = entry;
      stats.recent.tips = [entry, ...stats.recent.tips].slice(0, RECENT);
      // "Top" compares within the same currency as the current top; a different currency only wins if there's none yet.
      const beats = (top?: StatAmount) => !top || (top.currency === currency && amount.value > top.value);
      if (beats(stats.session.topTip)) stats.session.topTip = entry;
      if (beats(stats.total.topTip)) stats.total.topTip = entry;
      return true;
    }
    case "raid": {
      if (!person) {
        return false;
      }
      both.forEach((c) => (c.raids += 1));
      stats.latest.raid = { ...person, viewers: Number(data.viewers ?? 0) || 0 };
      return true;
    }
  }
  return false;
}

function sessionIsEmpty(c: Counters) {
  return c.followers + c.subs + c.bits + c.raids + c.tipCount === 0;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

/** Progress of a goal: its start value plus everything counted since it started. */
export function goalProgress(stats: Pick<StreamStats, "total"> & { goals: Record<string, GoalBaseline> }, overlayId: string) {
  const baseline = stats.goals[overlayId];
  return baseline ? Math.max(0, metricValue(stats.total, baseline.metric, baseline.currency) - baseline.value) : 0;
}
