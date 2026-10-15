import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { connections, streamStats } from "@/db/schema";
import type { SignalKitEvent } from "@/lib/events/types";
import { relayHub } from "@/lib/ws/relay";
import { applyEvent, emptyCounters, emptyStats, goalStart, mentionsYouTube, migrateLegacyStats, newBoss, pruneStats, publicStats, type StatMetric, type StreamStats } from "./stats-core";

/**
 * Stored, live-updated stream stats per user (see stats-core.ts for what is counted). YouTube
 * data older than 30 days is pruned whenever stats are read, and deleted from the database by
 * the hourly retention job (lib/retention/youtube.ts, via `purgeStatsYouTube`).
 */

// On globalThis like the other singletons: the Next route bundle (e.g. disconnecting YouTube) and
// the server bundle (event ingest) must share one cache and one queue per user, or one bundle's
// cached copy would write data the other just purged back on its next save.
const globalForStats = globalThis as typeof globalThis & {
  __signalKitStats?: { cache: Map<string, StreamStats>; queues: Map<string, Promise<unknown>> };
};
const { cache, queues } = (globalForStats.__signalKitStats ??= { cache: new Map(), queues: new Map() });

/** Runs updates for one user one at a time, so concurrent events never lose a count. */
function serial<T>(userId: string, job: () => Promise<T>): Promise<T> {
  const previous = queues.get(userId) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(job);
  queues.set(userId, next);
  void next.finally(() => {
    if (queues.get(userId) === next) {
      queues.delete(userId);
    }
  });
  return next;
}

export async function getStats(userId: string): Promise<StreamStats> {
  const cached = cache.get(userId);
  if (cached) {
    pruneStats(cached);
    return cached;
  }
  const [row] = await getDb().select({ state: streamStats.state }).from(streamStats).where(eq(streamStats.userId, userId)).limit(1);
  const stats = await fromStored(userId, row?.state);
  cache.set(userId, stats);
  return stats;
}

/** Stored JSON to stats: fills defaults, migrates pre-retention state, prunes old YouTube data. */
async function fromStored(userId: string, state: Record<string, unknown> | undefined) {
  const stats = { ...emptyStats(), ...((state ?? {}) as Partial<StreamStats>) } as StreamStats;
  if (state && !("youtubeDays" in state)) {
    const hadYouTube =
      mentionsYouTube(state) ||
      (await getDb()
        .select({ id: connections.id })
        .from(connections)
        .where(and(eq(connections.userId, userId), eq(connections.platform, "youtube")))
        .limit(1)).length > 0;
    migrateLegacyStats(stats, hadYouTube);
  }
  pruneStats(stats);
  return stats;
}

/**
 * Retention job: prunes the user's stats and writes them back if the stored copy still holds
 * anything older than 30 days from YouTube (or predates YouTube day buckets). With `all`
 * (YouTube disconnected or revoked) every YouTube part goes, whatever its age. Returns whether it saved.
 */
export function purgeStatsYouTube(userId: string, all = false) {
  return serial(userId, async () => {
    const [row] = await getDb().select({ state: streamStats.state }).from(streamStats).where(eq(streamStats.userId, userId)).limit(1);
    if (!row) {
      return false;
    }
    const legacy = !("youtubeDays" in row.state);
    const stored = { ...emptyStats(), ...structuredClone(row.state) } as StreamStats;
    if (!legacy && !pruneStats(stored, Date.now(), all)) {
      return false;
    }
    const stats = await fromStored(userId, row.state);
    if (all) {
      pruneStats(stats, Date.now(), true);
    }
    await save(userId, stats);
    return true;
  });
}

async function save(userId: string, stats: StreamStats) {
  cache.set(userId, stats);
  await getDb()
    .insert(streamStats)
    .values({ userId, state: stats as unknown as Record<string, unknown> })
    .onDuplicateKeyUpdate({ set: { state: stats as unknown as Record<string, unknown> } });
  relayHub.publish(userId, { type: "signal_kit.overlay.stats", stats: publicStats(stats) }, { overlaysOnly: true });
}

const TRACKED = new Set(["follow", "subscription", "subscription.gift", "tip", "raid", "stream.online"]);

/** Folds one ingested event into the user's stats. Test events never count. */
export function recordStats(userId: string, event: SignalKitEvent) {
  if (!TRACKED.has(event.kind)) {
    return Promise.resolve();
  }
  return serial(userId, async () => {
    const stats = structuredClone(await getStats(userId));
    if (applyEvent(stats, event)) {
      await save(userId, stats);
    }
  }).catch((error) => console.error("[stats] update failed", error));
}

/** Starts (or restarts) a goal overlay's count from the user's current total. */
export function startGoal(userId: string, overlayId: string, metric: StatMetric, currency: string) {
  return serial(userId, async () => {
    const stats = structuredClone(await getStats(userId));
    stats.goalBaselines[overlayId] = goalStart(stats, metric, currency);
    await save(userId, stats);
    return stats;
  });
}

/** Starts a goal unless it is already counting the same metric. */
export async function ensureGoal(userId: string, overlayId: string, metric: StatMetric, currency: string) {
  const current = (await getStats(userId)).goalBaselines[overlayId];
  if (!current || current.metric !== metric || (metric === "tips" && current.currency !== currency.toUpperCase())) {
    await startGoal(userId, overlayId, metric, currency);
  }
}

/** Starts the stream boss over (the dashboard's "Reset boss"). */
export function resetBoss(userId: string) {
  return serial(userId, async () => {
    const stats = structuredClone(await getStats(userId));
    stats.boss = newBoss();
    await save(userId, stats);
    return stats;
  });
}

/** Restarts session counters by hand (the dashboard's "Reset session"). */
export function resetSession(userId: string) {
  return serial(userId, async () => {
    const stats = structuredClone(await getStats(userId));
    stats.session = { ...emptyCounters(), startedAt: new Date().toISOString() };
    await save(userId, stats);
    return stats;
  });
}
