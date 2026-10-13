import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { streamStats } from "@/db/schema";
import type { SignalKitEvent } from "@/lib/events/types";
import { relayHub } from "@/lib/ws/relay";
import { applyEvent, emptyCounters, emptyStats, metricValue, newBoss, publicStats, type StatMetric, type StreamStats } from "./stats-core";

/** Stored, live-updated stream stats per user (see stats-core.ts for what is counted). */

const cache = new Map<string, StreamStats>();
const queues = new Map<string, Promise<unknown>>();

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
    return cached;
  }
  const [row] = await getDb().select({ state: streamStats.state }).from(streamStats).where(eq(streamStats.userId, userId)).limit(1);
  const stats = { ...emptyStats(), ...((row?.state ?? {}) as Partial<StreamStats>) } as StreamStats;
  cache.set(userId, stats);
  return stats;
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
    stats.goalBaselines[overlayId] = { metric, currency: currency.toUpperCase(), value: metricValue(stats.total, metric, currency), at: new Date().toISOString() };
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
