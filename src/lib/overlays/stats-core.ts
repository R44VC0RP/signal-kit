import type { EventPlatform, SignalKitEvent } from "@/lib/events/types";
import { isExpired } from "@/lib/retention/youtube-core";

/**
 * Running tallies per streamer behind goal bars and labels (latest follower, session subs, top
 * tip…). Updated as events are ingested, pushed live to open overlays, and stored so a restart
 * or a new OBS scene shows the same numbers. "session" restarts when a stream goes live;
 * "total" counts since Signal Kit started tracking.
 *
 * YouTube retention (API policy: nothing from YouTube older than 30 days): YouTube support is
 * counted into per-day buckets (`youtubeDays`) instead of `total`, and a bucket is deleted once
 * its day starts more than 30 days ago, so YouTube counts toward totals and goals for 30 days.
 * YouTube names (latest, recent, top, boss) disappear 30 days after the event, and a session
 * older than 30 days is reset. `pruneStats` applies this; `publicStats` prunes before serving.
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

/** The stream boss: support deals damage; the viewer who lands the final hit becomes the boss. */
export type Boss = {
  name: string;
  platform: EventPlatform | null;
  avatarUrl?: string | null;
  hp: number;
  maxHp: number;
  lastHit?: { name: string; damage: number; what: string; at: string; platform?: EventPlatform };
  /** When this boss appeared. */
  since?: string;
  /** First YouTube involvement in this boss's life (a YouTube boss or YouTube damage); the boss resets 30 days after it. */
  youtubeSince?: string;
};

export const BOSS_START_HP = 1000;
/** Each new boss is tougher than the last, up to a cap. */
const BOSS_HP_STEP = 250;
const BOSS_MAX_HP = 20_000;

export function newBoss(now = new Date()): Boss {
  return { name: "Signal Kit", platform: null, hp: BOSS_START_HP, maxHp: BOSS_START_HP, since: now.toISOString() };
}

/** Damage per kind of support: follow 10, sub 100 (tier 2: 200, tier 3: 500), gift 100 each, 1 per bit, 100 per dollar-ish, raid 2 per viewer. */
export function bossDamage(event: SignalKitEvent): { damage: number; what: string } | null {
  const data = event.data ?? {};
  switch (event.kind) {
    case "follow":
      return { damage: 10, what: "followed" };
    case "subscription": {
      if (event.platform === "twitch" && data.isGift === true) {
        return null;
      }
      const tier = data.tier === 3 ? 5 : data.tier === 2 ? 2 : 1;
      return { damage: 100 * tier, what: "subscribed" };
    }
    case "subscription.gift": {
      const count = typeof data.count === "number" && data.count > 0 ? data.count : 1;
      return { damage: 100 * count, what: `gifted ${count}` };
    }
    case "tip":
      if (!event.amount || !(event.amount.value > 0)) {
        return null;
      }
      return event.amount.currency === "BITS"
        ? { damage: Math.round(event.amount.value), what: `cheered ${event.amount.value}` }
        : { damage: Math.round(event.amount.value * 100), what: `tipped ${event.amount.display}` };
    case "raid":
      return { damage: 2 * (Number(data.viewers ?? 0) || 0), what: "raided" };
    default:
      return null;
  }
}

/**
 * `value` is the non-YouTube total when the goal started; YouTube support counts from the
 * day buckets on or after the start day, minus `youtubeAtStart` (that day's bucket value at the
 * start), which is dropped together with that day's bucket.
 */
export type GoalBaseline = { metric: StatMetric; currency: string; value: number; at: string; youtubeAtStart?: number };

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
  /** Lifetime counters without YouTube (YouTube support is in `youtubeDays`). */
  total: Counters & { topTip?: StatAmount; topCheer?: StatAmount };
  /** YouTube support per UTC day ("YYYY-MM-DD"), deleted after 30 days. */
  youtubeDays: Record<string, Counters>;
  boss?: Boss;
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
    youtubeDays: {},
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

// ---- YouTube retention ------------------------------------------------------------------------

function dayKey(at: string | number) {
  const time = typeof at === "number" ? at : Date.parse(at);
  return new Date(Number.isFinite(time) ? time : Date.now()).toISOString().slice(0, 10);
}

/** A day bucket is kept while its whole day is within the last 30 days. */
function dayExpired(day: string, now: number) {
  return isExpired(Date.parse(`${day}T00:00:00.000Z`), now);
}

function addCounters(into: Counters, add: Counters) {
  into.followers += add.followers ?? 0;
  into.subs += add.subs ?? 0;
  into.gifts += add.gifts ?? 0;
  into.bits += add.bits ?? 0;
  into.members += add.members ?? 0;
  into.raids += add.raids ?? 0;
  into.tipCount += add.tipCount ?? 0;
  for (const [currency, value] of Object.entries(add.tips ?? {})) {
    into.tips[currency] = round2((into.tips[currency] ?? 0) + value);
  }
}

/** YouTube support within the last 30 days, optionally only from `fromDay` on. */
function youtubeCounters(stats: Pick<StreamStats, "youtubeDays">, now: number, fromDay?: string) {
  const sum = emptyCounters();
  for (const [day, counters] of Object.entries(stats.youtubeDays ?? {})) {
    if (!dayExpired(day, now) && (!fromDay || day >= fromDay)) {
      addCounters(sum, counters);
    }
  }
  return sum;
}

/** Lifetime non-YouTube counters plus YouTube support from the last 30 days. */
export function totalWithYouTube(stats: Pick<StreamStats, "total" | "youtubeDays">, now = Date.now()): StreamStats["total"] {
  const merged = { ...stats.total, tips: { ...stats.total.tips } };
  addCounters(merged, youtubeCounters(stats, now));
  return merged;
}

/** Folds YouTube day buckets into `total` (overlays, after applying test events to served stats). */
export function mergeYouTubeDays(stats: StreamStats, now = Date.now()) {
  stats.total = totalWithYouTube(stats, now);
  stats.youtubeDays = {};
}

/** A YouTube person or amount whose event is more than 30 days old (with `all`: any YouTube one). */
function expiredYouTube(entry: { platform?: EventPlatform | null; at?: string } | undefined, now: number, all = false) {
  return Boolean(entry && entry.platform === "youtube" && (all || isExpired(entry.at, now)));
}

/**
 * Deletes YouTube data older than 30 days from stats, in place: day buckets, latest/recent/top
 * entries, a stale session, a boss with old YouTube involvement, and goal start values for
 * expired days. With `all` (YouTube disconnected or access revoked) it deletes every YouTube
 * part, whatever its age, and restarts the session and boss if they hold YouTube counts.
 * Returns whether anything changed.
 */
export function pruneStats(stats: StreamStats, now = Date.now(), all = false) {
  let changed = false;
  stats.youtubeDays ??= {};
  // Every YouTube count goes into a day bucket as well as the session, so a bucket from the
  // session's start day on means the session holds YouTube counts.
  const sessionDay = dayKey(stats.session.startedAt);
  const sessionHasYouTube = Object.keys(stats.youtubeDays).some((day) => day >= sessionDay) || Number(stats.session.members ?? 0) > 0;
  for (const day of Object.keys(stats.youtubeDays)) {
    if (all || dayExpired(day, now)) {
      delete stats.youtubeDays[day];
      changed = true;
    }
  }
  const latest = stats.latest as Record<string, StatPerson | undefined>;
  for (const key of Object.keys(latest)) {
    if (expiredYouTube(latest[key], now, all)) {
      delete latest[key];
      changed = true;
    }
  }
  for (const key of ["followers", "subscribers", "tips", "cheers"] as const) {
    const list = (stats.recent[key] ?? []) as StatPerson[];
    const kept = list.filter((entry) => !expiredYouTube(entry, now, all));
    if (kept.length !== list.length) {
      (stats.recent[key] as StatPerson[]) = kept;
      changed = true;
    }
  }
  // A session that started more than 30 days ago may hold old YouTube counts: start it over.
  if (all ? sessionHasYouTube : isExpired(stats.session.startedAt, now)) {
    stats.session = { ...emptyCounters(), startedAt: new Date(now).toISOString() };
    changed = true;
  }
  for (const key of ["topTip", "topCheer", "topGifter"] as const) {
    if (expiredYouTube(stats.session[key], now, all)) {
      delete stats.session[key];
      changed = true;
    }
  }
  for (const key of ["topTip", "topCheer"] as const) {
    if (expiredYouTube(stats.total[key], now, all)) {
      delete stats.total[key];
      changed = true;
    }
  }
  const boss = stats.boss;
  if (boss) {
    // The boss's HP holds YouTube damage since `youtubeSince` (a YouTube boss: since it appeared).
    const youtubeSince = boss.youtubeSince ?? (boss.platform === "youtube" ? (boss.since ?? "") : null);
    if (youtubeSince !== null && (all || isExpired(youtubeSince, now))) {
      stats.boss = newBoss(new Date(now));
      changed = true;
    } else if (boss.lastHit?.platform === "youtube" && (all || isExpired(boss.lastHit.at, now))) {
      delete boss.lastHit;
      changed = true;
    }
  }
  for (const baseline of Object.values(stats.goalBaselines ?? {})) {
    if (baseline.youtubeAtStart !== undefined && (all || dayExpired(dayKey(baseline.at), now))) {
      delete baseline.youtubeAtStart;
      changed = true;
    }
  }
  return changed;
}

/**
 * Stats stored before YouTube day buckets existed mix YouTube into `total`, goal start values and
 * the boss. If the user has (had) YouTube, the parts YouTube can contribute to are reset: YouTube
 * never sends follows, raids or bits (events/normalize.ts), so followers, bits and raids stay;
 * memberships come out of subs; gifts and tips (Super Chats and Super Stickers are tips) start
 * over, and so do goals on those metrics. Otherwise `total` is all non-YouTube.
 */
export function migrateLegacyStats(stats: StreamStats, hadYouTube: boolean, now = new Date()) {
  stats.youtubeDays ??= {};
  if (hadYouTube) {
    const total = { ...emptyCounters(), ...stats.total };
    stats.total = {
      ...emptyCounters(),
      followers: total.followers,
      bits: total.bits,
      raids: total.raids,
      subs: Math.max(0, total.subs - total.members),
      ...(total.topCheer ? { topCheer: total.topCheer } : {}),
      ...(total.topTip ? { topTip: total.topTip } : {}),
    };
    for (const baseline of Object.values(stats.goalBaselines ?? {})) {
      if (baseline.metric === "followers" || baseline.metric === "bits" || baseline.metric === "raids") {
        baseline.youtubeAtStart ??= 0;
      } else {
        // Restart the goal from now: its start value may include YouTube support.
        Object.assign(baseline, { value: metricValue(stats.total, baseline.metric, baseline.currency), at: now.toISOString(), youtubeAtStart: 0 });
      }
    }
    if (stats.boss) {
      stats.boss = newBoss(now);
    }
  } else if (stats.boss && !stats.boss.since) {
    stats.boss.since = stats.boss.lastHit?.at ?? now.toISOString();
  }
}

/** Whether stored (raw) stats show any sign of YouTube. */
export function mentionsYouTube(state: unknown) {
  const json = JSON.stringify(state ?? {});
  return json.includes('"platform":"youtube"') || Number((state as { total?: { members?: number } })?.total?.members ?? 0) > 0;
}

/** The goal's start values for a metric right now (non-YouTube total and today's YouTube bucket). */
export function goalStart(stats: StreamStats, metric: StatMetric, currency: string, now = Date.now()): GoalBaseline {
  const today = stats.youtubeDays?.[dayKey(now)];
  return {
    metric,
    currency: currency.toUpperCase(),
    value: metricValue(stats.total, metric, currency),
    at: new Date(now).toISOString(),
    youtubeAtStart: today ? metricValue(today, metric, currency) : 0,
  };
}

/** Progress of a goal: everything counted since it started (YouTube: within the last 30 days). */
export function goalProgress(stats: StreamStats, overlayId: string, now = Date.now()) {
  const baseline = stats.goalBaselines[overlayId];
  if (!baseline) {
    return 0;
  }
  const startDay = dayKey(baseline.at);
  const youtube = metricValue(youtubeCounters(stats, now, startDay), baseline.metric, baseline.currency);
  const startDayCounted = !dayExpired(startDay, now) && stats.youtubeDays?.[startDay];
  const offset = startDayCounted ? (baseline.youtubeAtStart ?? 0) : 0;
  return Math.max(0, metricValue(stats.total, baseline.metric, baseline.currency) - baseline.value + youtube - offset);
}

/**
 * What overlays get: pruned stats with YouTube support (last 30 days) merged into `total`,
 * and each goal's progress instead of the bookkeeping behind it.
 */
export function publicStats(input: StreamStats, now = Date.now()) {
  const stats = structuredClone(input);
  stats.youtubeDays ??= {};
  stats.goalBaselines ??= {};
  pruneStats(stats, now);
  const { goalBaselines, ...rest } = stats;
  delete (rest as Partial<StreamStats>).youtubeDays;
  const goals = Object.fromEntries(
    Object.entries(goalBaselines).map(([id, baseline]) => [id, { metric: baseline.metric, currency: baseline.currency, at: baseline.at, progress: goalProgress(stats, id, now) }]),
  );
  return { ...(rest as Omit<typeof rest, "youtubeDays">), total: totalWithYouTube(stats, now), goals };
}
export type PublicStats = ReturnType<typeof publicStats>;

/** Mutates `stats` for the event; returns whether anything changed. Pure, so it's easy to reason about. */
export function applyEvent(stats: StreamStats, event: SignalKitEvent): boolean {
  const bossChanged = applyBoss(stats, event);
  return applyCounters(stats, event) || bossChanged;
}

function applyBoss(stats: StreamStats, event: SignalKitEvent) {
  const hit = bossDamage(event);
  if (hit && hit.damage > 0) {
    const boss = (stats.boss ??= newBoss());
    const attacker = event.actor?.name || "Someone";
    const youtube = event.platform === "youtube";
    boss.lastHit = { name: attacker, damage: hit.damage, what: hit.what, at: event.occurredAt, platform: event.platform };
    boss.hp -= hit.damage;
    if (youtube) {
      boss.youtubeSince ??= event.occurredAt;
    }
    if (boss.hp <= 0) {
      // Final hit: the attacker takes over as a tougher boss.
      const maxHp = Math.min(BOSS_MAX_HP, boss.maxHp + BOSS_HP_STEP);
      stats.boss = {
        name: attacker,
        platform: event.platform,
        avatarUrl: event.actor?.avatarUrl ?? null,
        hp: maxHp,
        maxHp,
        lastHit: boss.lastHit,
        since: event.occurredAt,
        ...(youtube ? { youtubeSince: event.occurredAt } : {}),
      };
    }
    return true;
  }
  return false;
}

function applyCounters(stats: StreamStats, event: SignalKitEvent): boolean {
  const at = event.occurredAt;
  const person: StatPerson | null = event.actor ? { name: event.actor.name || "Someone", platform: event.platform, avatarUrl: event.actor.avatarUrl ?? null, at } : null;
  // YouTube support goes into today's bucket instead of the lifetime total (30-day retention).
  const both = [stats.session, event.platform === "youtube" ? ((stats.youtubeDays ??= {})[dayKey(at)] ??= emptyCounters()) : stats.total];
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
