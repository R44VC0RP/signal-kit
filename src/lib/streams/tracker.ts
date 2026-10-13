import { randomUUID } from "crypto";
import { and, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { chatters, connections, streamChatters, streams, type Platform } from "@/db/schema";
import { getConnectionAccessToken } from "@/lib/connections/tokens";
import type { SignalKitEvent } from "@/lib/events/types";
import { helixApp } from "@/lib/twitch/helix-app";
import { getLiveStreamingDetails } from "@/lib/youtube/api";
import { countEvent, emptyPlatform, emptySummary, minute, sampleViewers, trimSupporters, type StreamSummary } from "./summary";

/**
 * Turns the live event flow into a history of streams.
 *
 * A stream opens when any platform goes live (Twitch EventSub or the Helix poll below, YouTube
 * broadcast discovery, X broadcast.start) and closes when the last one ends, so a simulcast is
 * one stream. While open it counts chat, chatters (new vs returning), follows, subs, bits, tips,
 * raids and redemptions per platform, and samples viewers once a minute (Twitch via Helix,
 * YouTube via videos.list). Totals are written every 15 seconds.
 */

type ActiveStream = {
  id: string;
  userId: string;
  startedAt: string;
  title: string | null;
  summary: StreamSummary;
  /** Chatter ids already counted in this stream, per platform. */
  seen: Map<Platform, Set<string>>;
  /** Chat activity not yet written to stream_chatters / chatters. */
  pending: Map<string, { platform: Platform; chatterId: string; name: string; messages: number; firstAt: Date; lastAt: Date; newToStream: boolean }>;
  /** Consecutive polls a platform we think is live was reported offline. */
  misses: Partial<Record<Platform, number>>;
  /** Last event per platform (ends platforms we can't poll once they go quiet). */
  activity: Partial<Record<Platform, number>>;
  lastActivity: number;
  dirty: boolean;
};

type LiveInfo = { connectionId: string; startedAt?: string | null; title?: string | null; category?: string | null; broadcastId?: string | null };

const FLUSH_EVERY_MS = 15_000;
const POLL_EVERY_MS = 60_000;
/** A platform coming back within this long continues the same stream (brief disconnects). */
const RESUME_WITHIN_MS = 10 * 60 * 1000;
/** X has no viewer API (nor YouTube without a known broadcast); quiet this long means it's over. */
const UNPOLLABLE_IDLE_MS = 20 * 60 * 1000;
/** Twitch must look offline this many polls in a row before we end it (Helix lags a little). */
const OFFLINE_POLLS = 2;

class StreamTracker {
  private active = new Map<string, ActiveStream>();
  private queues = new Map<string, Promise<unknown>>();
  private started = false;

  start() {
    if (this.started) {
      return;
    }
    this.started = true;
    void this.serialAll(() => this.resumeOpenStreams());
    setInterval(() => void this.flushAll(), FLUSH_EVERY_MS);
    setInterval(() => void this.poll(), POLL_EVERY_MS);
    setTimeout(() => void this.poll(), 5000);
  }

  /** The user's live stream, if any (for the dashboard). */
  liveStreamId(userId: string) {
    return this.active.get(userId)?.id ?? null;
  }

  /** Called for every ingested event. */
  record(userId: string, connectionId: string, event: SignalKitEvent) {
    return this.serial(userId, async () => {
      const platform = event.platform as Platform;
      if (event.kind === "stream.online") {
        const data = event.data ?? {};
        await this.goLive(userId, platform, {
          connectionId,
          startedAt: event.occurredAt,
          title: typeof data.title === "string" ? data.title : null,
          broadcastId: typeof data.broadcastId === "string" ? data.broadcastId : null,
        });
        return;
      }
      if (event.kind === "stream.offline") {
        await this.platformEnded(userId, platform, new Date());
        return;
      }
      let stream = this.active.get(userId);
      // YouTube and X only have chat while a broadcast is live, so chat there means "live".
      if (event.kind === "chat.message" && platform !== "twitch" && !stream?.summary.platforms[platform]?.live) {
        stream = await this.goLive(userId, platform, { connectionId });
      }
      if (!stream) {
        return;
      }
      // Events from a platform that isn't live (a Twitch follow during a YouTube stream) still
      // count toward this stream, under that platform.
      const stats = (stream.summary.platforms[platform] ??= { ...emptyPlatform(connectionId, new Date().toISOString()), live: false });
      stream.lastActivity = Date.now();
      stream.activity[platform] = Date.now();
      if (event.kind === "chat.message") {
        stats.messages += 1;
        const point = minute(stream.summary, stream.startedAt, Date.now());
        if (point) {
          point.m[platform] = (point.m[platform] ?? 0) + 1;
        }
        this.countChatter(stream, platform, event);
        stream.dirty = true;
        return;
      }
      if (countEvent(stream.summary, event)) {
        stream.dirty = true;
      }
    }).catch((error) => console.error("[streams] record failed", error));
  }

  /** A platform reported live outside the event flow (YouTube discovery, Helix poll). */
  platformLive(userId: string, platform: Platform, info: LiveInfo) {
    return this.serial(userId, () => this.goLive(userId, platform, info)).catch((error) => console.error("[streams] live failed", error));
  }

  platformOffline(userId: string, platform: Platform) {
    return this.serial(userId, () => this.platformEnded(userId, platform, new Date())).catch((error) => console.error("[streams] offline failed", error));
  }

  // ---- Lifecycle ----------------------------------------------------------------------------

  private async goLive(userId: string, platform: Platform, info: LiveInfo) {
    let stream = this.active.get(userId);
    if (!stream) {
      stream = (await this.resumeRecent(userId)) ?? (await this.create(userId, info));
      this.active.set(userId, stream);
    }
    const existing = stream.summary.platforms[platform];
    const stats = existing ?? emptyPlatform(info.connectionId, validPast(info.startedAt) ?? new Date().toISOString());
    const wasLive = Boolean(existing?.live);
    stats.live = true;
    stats.endedAt = null;
    stats.connectionId = info.connectionId;
    stats.title = info.title ?? stats.title;
    stats.category = info.category ?? stats.category;
    stats.broadcastId = info.broadcastId ?? stats.broadcastId;
    stream.summary.platforms[platform] = stats;
    stream.title ??= info.title ?? null;
    stream.misses[platform] = 0;
    stream.lastActivity = Date.now();
    stream.activity[platform] = Date.now();
    if (!wasLive) {
      stream.dirty = true;
      await this.save(stream);
      console.log(`[streams] ${platform} live for ${userId} (stream ${stream.id})`);
    }
    return stream;
  }

  private async platformEnded(userId: string, platform: Platform, at: Date) {
    const stream = this.active.get(userId);
    const stats = stream?.summary.platforms[platform];
    if (!stream || !stats?.live) {
      return;
    }
    stats.live = false;
    stats.endedAt = at.toISOString();
    stream.dirty = true;
    console.log(`[streams] ${platform} offline for ${userId} (stream ${stream.id})`);
    if (!Object.values(stream.summary.platforms).some((p) => p?.live)) {
      await this.finish(stream, at);
    } else {
      await this.save(stream);
    }
  }

  private async finish(stream: ActiveStream, at: Date) {
    await this.flushChatters(stream);
    trimSupporters(stream.summary);
    for (const stats of Object.values(stream.summary.platforms)) {
      if (stats) {
        stats.live = false;
        stats.endedAt ??= at.toISOString();
      }
    }
    await getDb().update(streams).set({ endedAt: at, title: stream.title, summary: stream.summary }).where(eq(streams.id, stream.id));
    this.active.delete(stream.userId);
    console.log(`[streams] stream ${stream.id} ended`);
  }

  private async create(userId: string, info: LiveInfo): Promise<ActiveStream> {
    const startedAt = validPast(info.startedAt) ?? new Date().toISOString();
    const id = randomUUID();
    const summary = emptySummary();
    await getDb()
      .insert(streams)
      .values({ id, userId, startedAt: new Date(startedAt), title: info.title ?? null, summary });
    return blank(id, userId, startedAt, info.title ?? null, summary);
  }

  /** Reopens the user's last stream if it ended moments ago (a dropped connection, not a new stream). */
  private async resumeRecent(userId: string) {
    const [row] = await getDb().select().from(streams).where(eq(streams.userId, userId)).orderBy(desc(streams.startedAt)).limit(1);
    if (!row?.endedAt || Date.now() - row.endedAt.getTime() > RESUME_WITHIN_MS) {
      return null;
    }
    await getDb().update(streams).set({ endedAt: null }).where(eq(streams.id, row.id));
    return this.hydrate(row);
  }

  /** After a restart: pick up streams that were live, or close ones that went quiet meanwhile. */
  private async resumeOpenStreams() {
    const rows = await getDb().select().from(streams).where(isNull(streams.endedAt));
    for (const row of rows) {
      const stream = await this.hydrate(row);
      if (Date.now() - row.updatedAt.getTime() > 30 * 60 * 1000) {
        await this.finish(stream, row.updatedAt);
      } else {
        this.active.set(row.userId, stream);
      }
    }
  }

  private async hydrate(row: typeof streams.$inferSelect): Promise<ActiveStream> {
    const stream = blank(row.id, row.userId, row.startedAt.toISOString(), row.title, { ...emptySummary(), ...row.summary });
    const seen = await getDb().select({ platform: streamChatters.platform, chatterId: streamChatters.chatterId }).from(streamChatters).where(eq(streamChatters.streamId, row.id));
    for (const { platform, chatterId } of seen) {
      const set = stream.seen.get(platform) ?? new Set<string>();
      set.add(chatterId);
      stream.seen.set(platform, set);
    }
    return stream;
  }

  // ---- Chatters -----------------------------------------------------------------------------

  private countChatter(stream: ActiveStream, platform: Platform, event: SignalKitEvent) {
    const actor = event.actor;
    const chatterId = String(actor?.id ?? actor?.login ?? actor?.name ?? "").slice(0, 128);
    if (!chatterId) {
      return;
    }
    const seen = stream.seen.get(platform) ?? new Set<string>();
    stream.seen.set(platform, seen);
    const newToStream = !seen.has(chatterId);
    if (newToStream) {
      seen.add(chatterId);
      stream.summary.platforms[platform]!.chatters += 1;
    }
    const key = `${platform}:${chatterId}`;
    const now = new Date();
    const entry = stream.pending.get(key) ?? { platform, chatterId, name: (actor?.name || chatterId).slice(0, 128), messages: 0, firstAt: now, lastAt: now, newToStream: false };
    entry.messages += 1;
    entry.lastAt = now;
    entry.newToStream ||= newToStream;
    stream.pending.set(key, entry);
  }

  /** Writes buffered chat activity: per-stream chatters, lifetime chatters, and who is new. */
  private async flushChatters(stream: ActiveStream) {
    if (stream.pending.size === 0) {
      return;
    }
    const batch = [...stream.pending.values()];
    stream.pending.clear();
    const db = getDb();
    // First-ever chatters: new to this stream and not yet in the lifetime table.
    for (const platform of new Set(batch.filter((entry) => entry.newToStream).map((entry) => entry.platform))) {
      const ids = batch.filter((entry) => entry.newToStream && entry.platform === platform).map((entry) => entry.chatterId);
      for (let i = 0; i < ids.length; i += 500) {
        const slice = ids.slice(i, i + 500);
        const known = await db
          .select({ chatterId: chatters.chatterId })
          .from(chatters)
          .where(and(eq(chatters.userId, stream.userId), eq(chatters.platform, platform), inArray(chatters.chatterId, slice)));
        const stats = stream.summary.platforms[platform];
        if (stats) {
          stats.newChatters += slice.length - known.length;
        }
      }
    }
    for (let i = 0; i < batch.length; i += 500) {
      const slice = batch.slice(i, i + 500);
      await db
        .insert(streamChatters)
        .values(slice.map((entry) => ({ streamId: stream.id, platform: entry.platform, chatterId: entry.chatterId, name: entry.name, messages: entry.messages, firstAt: entry.firstAt, lastAt: entry.lastAt })))
        .onDuplicateKeyUpdate({ set: { messages: sql`${streamChatters.messages} + values(${streamChatters.messages})`, lastAt: sql`values(${streamChatters.lastAt})`, name: sql`values(${streamChatters.name})` } });
      await db
        .insert(chatters)
        .values(
          slice.map((entry) => ({
            userId: stream.userId,
            platform: entry.platform,
            chatterId: entry.chatterId,
            name: entry.name,
            messages: entry.messages,
            streams: entry.newToStream ? 1 : 0,
            firstSeenAt: entry.firstAt,
            lastSeenAt: entry.lastAt,
          })),
        )
        .onDuplicateKeyUpdate({
          set: {
            messages: sql`${chatters.messages} + values(${chatters.messages})`,
            streams: sql`${chatters.streams} + values(${chatters.streams})`,
            lastSeenAt: sql`values(${chatters.lastSeenAt})`,
            name: sql`values(${chatters.name})`,
          },
        });
    }
    stream.dirty = true;
  }

  // ---- Persistence --------------------------------------------------------------------------

  private async save(stream: ActiveStream) {
    stream.dirty = false;
    await getDb().update(streams).set({ title: stream.title, summary: stream.summary }).where(eq(streams.id, stream.id));
  }

  private async flushAll() {
    for (const stream of [...this.active.values()]) {
      await this.serial(stream.userId, async () => {
        const current = this.active.get(stream.userId);
        if (!current) {
          return;
        }
        await this.flushChatters(current);
        if (current.dirty) {
          await this.save(current);
        }
      }).catch((error) => console.error("[streams] flush failed", error));
    }
  }

  // ---- Viewer polling and live detection ----------------------------------------------------

  private async poll() {
    await Promise.allSettled([this.pollTwitch(), this.pollYouTube(), this.expireQuiet()]);
  }

  /** Helix /streams for every connected Twitch channel (100 per request): live state, title, game, viewers. */
  private async pollTwitch() {
    if (!process.env.TWITCH_CLIENT_ID) {
      return;
    }
    const rows = await getDb()
      .select({ id: connections.id, userId: connections.userId, platformUserId: connections.platformUserId })
      .from(connections)
      .where(and(eq(connections.platform, "twitch"), eq(connections.status, "active"), ne(connections.role, "bot")));
    const live = new Map<string, { viewer_count: number; started_at: string; title: string; game_name: string }>();
    for (let i = 0; i < rows.length; i += 100) {
      const query = rows
        .slice(i, i + 100)
        .map((row) => `user_id=${encodeURIComponent(row.platformUserId)}`)
        .join("&");
      const result = await helixApp<{ data: { user_id: string; type: string; viewer_count: number; started_at: string; title: string; game_name: string }[] }>("GET", `/streams?first=100&${query}`);
      for (const entry of result.data) {
        if (entry.type === "live") {
          live.set(entry.user_id, entry);
        }
      }
    }
    for (const row of rows) {
      const entry = live.get(row.platformUserId);
      await this.serial(row.userId, async () => {
        if (entry) {
          const stream = await this.goLive(row.userId, "twitch", { connectionId: row.id, startedAt: entry.started_at, title: entry.title, category: entry.game_name });
          stream.summary.platforms.twitch!.title = entry.title;
          stream.summary.platforms.twitch!.category = entry.game_name;
          sampleViewers(stream.summary, stream.startedAt, "twitch", entry.viewer_count);
          stream.dirty = true;
          return;
        }
        const stream = this.active.get(row.userId);
        if (stream?.summary.platforms.twitch?.live && stream.summary.platforms.twitch.connectionId === row.id) {
          stream.misses.twitch = (stream.misses.twitch ?? 0) + 1;
          if (stream.misses.twitch >= OFFLINE_POLLS) {
            await this.platformEnded(row.userId, "twitch", new Date());
          }
        }
      }).catch((error) => console.error("[streams] twitch poll failed", error));
    }
  }

  /** videos.list liveStreamingDetails (1 quota unit) for each live YouTube broadcast: viewers and the end. */
  private async pollYouTube() {
    for (const stream of [...this.active.values()]) {
      const stats = stream.summary.platforms.youtube;
      if (!stats?.live || !stats.broadcastId) {
        continue;
      }
      try {
        const { accessToken } = await getConnectionAccessToken(stats.connectionId);
        const details = await getLiveStreamingDetails(accessToken, stats.broadcastId);
        await this.serial(stream.userId, async () => {
          if (details?.actualEndTime) {
            await this.platformEnded(stream.userId, "youtube", new Date(details.actualEndTime));
            return;
          }
          const viewers = Number(details?.concurrentViewers);
          if (Number.isFinite(viewers)) {
            sampleViewers(stream.summary, stream.startedAt, "youtube", viewers);
            stream.dirty = true;
          }
        });
      } catch (error) {
        console.warn(`[streams] youtube viewers for ${stream.id}: ${(error as Error).message}`);
      }
    }
  }

  /** Ends platforms we can't poll (X) once they've been quiet a while, and long-dead streams. */
  private async expireQuiet() {
    for (const stream of [...this.active.values()]) {
      const idle = Date.now() - stream.lastActivity;
      await this.serial(stream.userId, async () => {
        if (this.active.get(stream.userId) !== stream) {
          return;
        }
        for (const platform of ["x", "youtube"] as const) {
          const stats = stream.summary.platforms[platform];
          const last = stream.activity[platform] ?? stream.lastActivity;
          const unpollable = platform === "x" || !stats?.broadcastId;
          if (stats?.live && unpollable && Date.now() - last > UNPOLLABLE_IDLE_MS) {
            await this.platformEnded(stream.userId, platform, new Date(last));
          }
        }
        if (this.active.get(stream.userId) === stream && idle > 6 * 60 * 60 * 1000) {
          await this.finish(stream, new Date(stream.lastActivity));
        }
      }).catch((error) => console.error("[streams] expire failed", error));
    }
  }

  // ---- Ordering -----------------------------------------------------------------------------

  /** One update at a time per user, so a stream is never created twice or double-counted. */
  private serial<T>(userId: string, job: () => Promise<T>): Promise<T> {
    const next = (this.queues.get(userId) ?? Promise.resolve()).catch(() => {}).then(job);
    this.queues.set(userId, next);
    void next.finally(() => {
      if (this.queues.get(userId) === next) {
        this.queues.delete(userId);
      }
    });
    return next;
  }

  private async serialAll(job: () => Promise<void>) {
    try {
      await job();
    } catch (error) {
      console.error("[streams] resume failed", error);
    }
  }
}

function blank(id: string, userId: string, startedAt: string, title: string | null, summary: StreamSummary): ActiveStream {
  return { id, userId, startedAt, title, summary, seen: new Map(), pending: new Map(), misses: {}, activity: {}, lastActivity: Date.now(), dirty: false };
}

/** A platform's own start time, if it's believable (not in the future, not days ago). */
function validPast(value: string | null | undefined) {
  const time = value ? Date.parse(value) : NaN;
  return Number.isFinite(time) && time <= Date.now() + 60_000 && Date.now() - time < 24 * 60 * 60 * 1000 ? new Date(Math.min(time, Date.now())).toISOString() : null;
}

const globalForStreams = globalThis as typeof globalThis & { __signalKitStreams?: StreamTracker };
export const streamTracker = globalForStreams.__signalKitStreams ?? new StreamTracker();
globalForStreams.__signalKitStreams = streamTracker;
