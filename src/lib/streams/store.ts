import { and, desc, eq, gte, lt, ne, or } from "drizzle-orm";
import { getDb } from "@/db";
import { chatters, streamChatters, streams } from "@/db/schema";
import { isExpired, stripYouTubeFromSummary, youtubeCutoff } from "@/lib/retention/youtube-core";
import { totals, type CreditsData, type StreamSummary } from "./summary";

/** Reads for the Streams dashboard (and, later, recap emails). */

export type StreamRow = {
  id: string;
  startedAt: string;
  endedAt: string | null;
  title: string | null;
  summary: StreamSummary;
};

/**
 * YouTube parts of streams older than 30 days are deleted hourly (lib/retention/youtube.ts);
 * this strips them on read as well, so they can never be shown even if that job lags.
 */
const toRow = (row: typeof streams.$inferSelect): StreamRow => {
  let { title, summary } = row;
  if (isExpired(row.startedAt) && !summary.youtubePurgedAt) {
    ({ title, summary } = stripYouTubeFromSummary(summary, title));
  }
  return { id: row.id, startedAt: row.startedAt.toISOString(), endedAt: row.endedAt?.toISOString() ?? null, title, summary };
};

export async function listStreams(userId: string, limit = 60) {
  const rows = await getDb().select().from(streams).where(eq(streams.userId, userId)).orderBy(desc(streams.startedAt)).limit(limit);
  return rows.map(toRow);
}

export async function getStream(userId: string, id: string) {
  const [row] = await getDb()
    .select()
    .from(streams)
    .where(and(eq(streams.userId, userId), eq(streams.id, id)))
    .limit(1);
  return row ? toRow(row) : null;
}

/** The stream before this one, to compare against. */
export async function previousStream(userId: string, before: string) {
  const [row] = await getDb()
    .select()
    .from(streams)
    .where(and(eq(streams.userId, userId), lt(streams.startedAt, new Date(before))))
    .orderBy(desc(streams.startedAt))
    .limit(1);
  return row ? toRow(row) : null;
}

/** Most active chatters in a stream, with whether it was their first stream with you. */
export async function topChatters(userId: string, streamId: string, limit = 20) {
  const [stream] = await getDb().select({ startedAt: streams.startedAt }).from(streams).where(eq(streams.id, streamId)).limit(1);
  // YouTube chatters of streams older than 30 days are deleted; never show them meanwhile.
  const youtubeExpired = !stream || isExpired(stream.startedAt);
  const rows = await getDb()
    .select({
      platform: streamChatters.platform,
      chatterId: streamChatters.chatterId,
      name: streamChatters.name,
      messages: streamChatters.messages,
      firstSeenAt: chatters.firstSeenAt,
      streams: chatters.streams,
    })
    .from(streamChatters)
    .leftJoin(chatters, and(eq(chatters.userId, userId), eq(chatters.platform, streamChatters.platform), eq(chatters.chatterId, streamChatters.chatterId)))
    .where(and(eq(streamChatters.streamId, streamId), youtubeExpired ? ne(streamChatters.platform, "youtube") : undefined))
    .orderBy(desc(streamChatters.messages))
    .limit(limit);
  return rows;
}

/** Your regulars: who has chatted in the most streams (YouTube: in the last 30 days only). */
export async function regulars(userId: string, limit = 10) {
  return getDb()
    .select({ platform: chatters.platform, name: chatters.name, messages: chatters.messages, streams: chatters.streams, lastSeenAt: chatters.lastSeenAt })
    .from(chatters)
    .where(and(eq(chatters.userId, userId), or(ne(chatters.platform, "youtube"), gte(chatters.firstSeenAt, new Date(youtubeCutoff())))))
    .orderBy(desc(chatters.streams), desc(chatters.messages))
    .limit(limit);
}

export function durationMs(stream: Pick<StreamRow, "startedAt" | "endedAt">, now: number) {
  return Math.max(0, (stream.endedAt ? Date.parse(stream.endedAt) : now) - Date.parse(stream.startedAt));
}

/** Sums for a period: streams, hours, average viewers (weighted by duration), chatters, follows… */
export function periodTotals(rows: StreamRow[], now: number) {
  let hours = 0;
  let weightedViewers = 0;
  const sums = { streams: rows.length, chatters: 0, newChatters: 0, messages: 0, follows: 0, subs: 0, bits: 0, peakViewers: 0, tips: {} as Record<string, number> };
  for (const row of rows) {
    const t = totals(row.summary);
    const h = durationMs(row, now) / 3_600_000;
    hours += h;
    weightedViewers += t.avgViewers * h;
    sums.chatters += t.chatters;
    sums.newChatters += t.newChatters;
    sums.messages += t.messages;
    sums.follows += t.follows;
    sums.subs += t.subs;
    sums.bits += t.bits;
    sums.peakViewers = Math.max(sums.peakViewers, t.peakViewers);
    for (const [currency, value] of Object.entries(t.tips)) {
      sums.tips[currency] = Math.round(((sums.tips[currency] ?? 0) + value) * 100) / 100;
    }
  }
  return { ...sums, hours, avgViewers: hours > 0 ? Math.round(weightedViewers / hours) : 0 };
}

export async function streamsSince(userId: string, since: Date) {
  const rows = await getDb()
    .select()
    .from(streams)
    .where(and(eq(streams.userId, userId), gte(streams.startedAt, since)))
    .orderBy(desc(streams.startedAt));
  return rows.map(toRow);
}

/** Names for end-of-stream credits: the live stream, or the one that just ended (within 12 h). */
export async function streamCredits(userId: string): Promise<CreditsData | null> {
  const [latest] = await listStreams(userId, 1);
  if (!latest || (latest.endedAt && Date.now() - Date.parse(latest.endedAt) > 12 * 3_600_000)) {
    return null;
  }
  const unique = (names: string[]) => [...new Set(names)];
  const moments = latest.summary.highlights;
  const of = (kind: string) => moments.filter((moment) => moment.kind === kind);
  const gifts = new Map<string, number>();
  for (const moment of of("subscription.gift")) {
    gifts.set(moment.name, (gifts.get(moment.name) ?? 0) + (Number.parseInt(moment.detail ?? "1", 10) || 1));
  }
  const chatterRows = await getDb()
    .select({ name: streamChatters.name })
    .from(streamChatters)
    .where(eq(streamChatters.streamId, latest.id))
    .orderBy(desc(streamChatters.messages))
    .limit(60);
  return {
    streamTitle: latest.title,
    followers: unique(of("follow").map((moment) => moment.name)),
    subscribers: unique(of("subscription").map((moment) => moment.name)),
    gifters: [...gifts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    cheers: of("tip")
      .filter((moment) => moment.detail?.endsWith("bits"))
      .map((moment) => ({ name: moment.name, amount: moment.detail ?? "" })),
    tips: of("tip")
      .filter((moment) => !moment.detail?.endsWith("bits"))
      .map((moment) => ({ name: moment.name, amount: moment.detail ?? "" })),
    raiders: of("raid").map((moment) => ({ name: moment.name, viewers: Number.parseInt(moment.detail ?? "0", 10) || 0 })),
    chatters: unique(chatterRows.map((row) => row.name)),
  };
}
