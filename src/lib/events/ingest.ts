import { and, asc, desc, eq, gt, lt } from "drizzle-orm";
import { getDb } from "@/db";
import { connections, events, type Platform } from "@/db/schema";
import { recordStats } from "@/lib/overlays/stats";
import { streamTracker } from "@/lib/streams/tracker";
import { relayHub } from "@/lib/ws/relay";
import { newEventId } from "./ids";
import type { NormalizedFields } from "./normalize";
import type { SignalKitEvent } from "./types";

/** Events are kept this long for `since` replay. */
export const EVENT_RETENTION_MS = 24 * 60 * 60 * 1000;
export const MAX_REPLAY = 1000;

export type EventSource = {
  connectionId: string;
  userId: string;
  platform: Platform;
  platformUserId: string;
  displayName: string;
};

/**
 * Stores and delivers one platform event. Returns null when the same platform message was
 * already ingested (platform redeliveries and reconnect overlaps), so clients never see duplicates.
 */
export async function ingestEvent(
  source: EventSource,
  input: { rawType: string; raw: unknown; sourceId: string; normalized: NormalizedFields },
): Promise<SignalKitEvent | null> {
  const receivedAt = new Date().toISOString();
  const event: SignalKitEvent = {
    v: 2,
    id: newEventId(),
    kind: input.normalized.kind,
    platform: source.platform,
    channel: { connectionId: source.connectionId, id: source.platformUserId, name: source.displayName },
    actor: input.normalized.actor,
    message: input.normalized.message,
    ...(input.normalized.messageParts?.length ? { messageParts: input.normalized.messageParts } : {}),
    amount: input.normalized.amount,
    data: input.normalized.data,
    occurredAt: validDate(input.normalized.occurredAt) ?? receivedAt,
    receivedAt,
    raw: { type: input.rawType, event: input.raw },
    type: input.rawType,
    provider: source.platform,
    event: input.raw,
  };

  try {
    await getDb().insert(events).values({
      id: event.id,
      userId: source.userId,
      connectionId: source.connectionId,
      platform: source.platform,
      kind: event.kind,
      sourceId: input.sourceId.slice(0, 191),
      envelope: event,
    });
  } catch (error) {
    if (isDuplicate(error)) {
      return null;
    }
    // Delivery matters more than the replay log; still publish if the write fails.
    console.error("[events] failed to store event", error);
  }

  relayHub.publish(source.userId, event);
  void recordStats(source.userId, event);
  void streamTracker.record(source.userId, source.connectionId, event);
  touchConnection(source.connectionId);
  return event;
}

/** Events for a user after `since` (exclusive), oldest first. */
export async function eventsSince(userId: string, since: string, limit = MAX_REPLAY) {
  const rows = await getDb()
    .select({ envelope: events.envelope })
    .from(events)
    .where(and(eq(events.userId, userId), gt(events.id, since)))
    .orderBy(asc(events.id))
    .limit(limit);
  return rows.map((row) => row.envelope as SignalKitEvent);
}

/**
 * A user's stored events, newest first, optionally only those older than `before` (an event id).
 * Returns one extra row's worth of information as `hasMore` so callers can offer "load older".
 */
export async function recentEvents(userId: string, options: { before?: string | null; limit?: number } = {}) {
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 500);
  const rows = await getDb()
    .select({ envelope: events.envelope })
    .from(events)
    .where(options.before ? and(eq(events.userId, userId), lt(events.id, options.before)) : eq(events.userId, userId))
    .orderBy(desc(events.id))
    .limit(limit + 1);
  return {
    events: rows.slice(0, limit).map((row) => row.envelope as SignalKitEvent),
    hasMore: rows.length > limit,
  };
}

/** `lastEventAt` is display-only; write it at most every 30s per connection. */
const touched = new Map<string, number>();
function touchConnection(connectionId: string) {
  const now = Date.now();
  if ((touched.get(connectionId) ?? 0) > now - 30_000) {
    return;
  }
  touched.set(connectionId, now);
  void getDb()
    .update(connections)
    .set({ lastEventAt: new Date(now) })
    .where(eq(connections.id, connectionId))
    .catch(() => {});
}

let retentionTimer: NodeJS.Timeout | undefined;

export function startEventRetention() {
  if (retentionTimer) {
    return;
  }
  const prune = async () => {
    const cutoff = new Date(Date.now() - EVENT_RETENTION_MS);
    try {
      await getDb().delete(events).where(lt(events.createdAt, cutoff));
    } catch (error) {
      console.error("[events] retention prune failed", error);
    }
  };
  void prune();
  retentionTimer = setInterval(() => void prune(), 10 * 60 * 1000);
}

function validDate(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

function isDuplicate(error: unknown) {
  const cause = (error as { cause?: { code?: string } })?.cause ?? error;
  return (cause as { code?: string })?.code === "ER_DUP_ENTRY";
}
