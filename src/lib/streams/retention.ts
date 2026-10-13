import { and, eq, lt } from "drizzle-orm";
import { getDb } from "@/db";
import { chatters, streamChatters, streamStats, streams } from "@/db/schema";

/**
 * YouTube's API policies don't allow keeping YouTube user data for more than 30 days without
 * refreshing it. Stream history keeps its numbers forever, but YouTube viewers' names and
 * pictures older than 30 days are removed: chatter rows are deleted, and names inside stream
 * summaries and goal/label stats become "YouTube viewer". Runs daily.
 */

const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const PLACEHOLDER = "YouTube viewer";

/** Replaces old YouTube names anywhere in a JSON value: objects with platform "youtube". */
function scrub(value: unknown, cutoff: number, fallbackAt: number): { value: unknown; changed: boolean } {
  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((item) => {
      const result = scrub(item, cutoff, fallbackAt);
      changed ||= result.changed;
      return result.value;
    });
    return { value: next, changed };
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    let changed = false;
    const next: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(record)) {
      const result = scrub(item, cutoff, fallbackAt);
      changed ||= result.changed;
      next[key] = result.value;
    }
    const at = typeof record.at === "string" ? Date.parse(record.at) : fallbackAt;
    if (record.platform === "youtube" && typeof record.name === "string" && record.name !== PLACEHOLDER && at < cutoff) {
      next.name = PLACEHOLDER;
      next.avatarUrl = null;
      changed = true;
    }
    return { value: next, changed };
  }
  return { value, changed: false };
}

export async function pruneYouTubeData() {
  const db = getDb();
  const cutoffDate = new Date(Date.now() - MAX_AGE_MS);
  const cutoff = cutoffDate.getTime();
  await db.delete(streamChatters).where(and(eq(streamChatters.platform, "youtube"), lt(streamChatters.lastAt, cutoffDate)));
  await db.delete(chatters).where(and(eq(chatters.platform, "youtube"), lt(chatters.lastSeenAt, cutoffDate)));

  const old = await db.select({ id: streams.id, startedAt: streams.startedAt, summary: streams.summary }).from(streams).where(lt(streams.startedAt, cutoffDate));
  for (const row of old) {
    const result = scrub(row.summary, cutoff, row.startedAt.getTime());
    if (result.changed) {
      await db.update(streams).set({ summary: result.value as typeof row.summary }).where(eq(streams.id, row.id));
    }
  }
  const stats = await db.select().from(streamStats);
  for (const row of stats) {
    const result = scrub(row.state, cutoff, Date.now());
    if (result.changed) {
      await db.update(streamStats).set({ state: result.value as Record<string, unknown> }).where(eq(streamStats.userId, row.userId));
    }
  }
}
