import { and, eq, inArray, isNull, lt, ne, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { accounts, chatters, connections, events, liveTools, loyalty, streamChatters, streamStats, streams } from "@/db/schema";
import { connectionEvents } from "@/lib/connections/events";
import { refreshConnectionProfile } from "@/lib/connections/sync";
import { ConnectionUnavailableError, forceRefresh, getConnectionAccessToken } from "@/lib/connections/tokens";
import { liveToolsHub } from "@/lib/live/tools";
import { purgeStatsYouTube } from "@/lib/overlays/stats";
import { streamTracker } from "@/lib/streams/tracker";
import type { StreamSummary } from "@/lib/streams/summary";
import { isExpired, stripYouTubeFromSummary, youtubeCutoff, YOUTUBE_RETENTION_MS } from "./youtube-core";

export { YOUTUBE_RETENTION_MS };

/**
 * Deletes data obtained from YouTube API Services once it is more than 30 days old (YouTube API
 * policy III.E.4: refresh or delete within 30 days; past chat, viewer counts and Super Chats
 * can't be refreshed). Runs a minute after start and then every hour, so nothing from YouTube
 * is ever kept longer than 30 days plus one hour; reads also hide it right at 30 days
 * (streams/store.ts, overlays/stats-core.ts, live/tools.ts, bot/loyalty.ts).
 *
 * - streams: streams that started more than 30 days ago lose their YouTube part (stats, viewer
 *   samples, timeline values, supporters, highlights, a YouTube-only title); a stream that was
 *   only on YouTube is deleted with its chatters.
 * - stream_chatters: YouTube rows of streams that started more than 30 days ago.
 * - chatters: YouTube rows are recounted from the last 30 days of streams (messages, streams,
 *   first/last seen) or deleted, so "new" vs "returning" on YouTube means within 30 days.
 * - stream_stats: YouTube day buckets, names and amounts older than 30 days (stats-core.ts).
 * - loyalty: YouTube viewers with no activity for 30 days.
 * - live_tools: polls and giveaways started more than 30 days ago, old YouTube queue entries and pins.
 * - connections: a connected YouTube channel's profile (title, handle, picture) is re-read from
 *   YouTube when it is a week old; if that fails until it is 30 days old, it is cleared.
 * - events (raw, all platforms) are deleted after 24 hours elsewhere (events/ingest.ts).
 *
 * Revocation and deletion (YouTube Developer Policies III.E.4.g, III.D.2.c: delete within 7 days):
 * disconnecting YouTube in the dashboard deletes everything Signal Kit stored from YouTube for
 * that user right away (`purgeUserYouTubeData`, from connections/manage.ts). Each hourly run
 * first refreshes the Google token of every active YouTube connection whose token is expired or
 * expires within the hour (Google tokens last an hour, so in practice each connection once per
 * run): Google rejects the refresh once access was revoked, which marks the connection
 * needs_reauth. The same run then does the full purge for any user who still has YouTube data
 * but no active YouTube connection (revoked, or the connection is gone), clears such a
 * connection's channel profile and deletes its stored Google tokens; the connection row keeps
 * only the channel id so the dashboard can offer "Reconnect". So revoking at Google is acted on
 * at the next hourly run (sooner if Signal Kit uses the token first), well within 7 days.
 */

const EVERY_MS = 60 * 60 * 1000;
const FIRST_RUN_AFTER_MS = 60 * 1000;
const STREAM_BATCH = 200;
const PROFILE_REFRESH_MS = 7 * 24 * 60 * 60 * 1000;
/** Tokens expiring within this window are refreshed by the hourly run (see checkYouTubeGrants). */
const GRANT_CHECK_WINDOW_MS = EVERY_MS;
/** getAccountAccessToken refreshes by itself inside this window (connections/tokens.ts). */
const GETTER_REFRESH_WINDOW_MS = 5 * 60 * 1000;

export type PurgeResult = {
  streamsStripped: number;
  streamsDeleted: number;
  streamChatters: number;
  chattersRecounted: number;
  chattersDeleted: number;
  loyalty: number;
  stats: number;
  liveTools: number;
  profilesRefreshed: number;
  profilesCleared: number;
  /** Active YouTube connections whose Google grant was checked by a token refresh, and those found revoked. */
  grantsChecked: number;
  grantsRevoked: number;
  /** Users whose YouTube access was revoked or removed: all their YouTube data was deleted. */
  revokedUsers: number;
};

function affected(result: unknown) {
  const header = Array.isArray(result) ? result[0] : result;
  return Number((header as { affectedRows?: number } | undefined)?.affectedRows ?? 0);
}

export async function purgeYouTubeData(now = Date.now()): Promise<PurgeResult> {
  const db = getDb();
  const cutoff = new Date(youtubeCutoff(now));
  // Raw SQL gets the cutoff the way drizzle writes timestamps (UTC, no zone), not as a local-time Date.
  const cutoffSql = cutoff.toISOString().slice(0, -1).replace("T", " ");
  const result: PurgeResult = { streamsStripped: 0, streamsDeleted: 0, streamChatters: 0, chattersRecounted: 0, chattersDeleted: 0, loyalty: 0, stats: 0, liveTools: 0, profilesRefreshed: 0, profilesCleared: 0, grantsChecked: 0, grantsRevoked: 0, revokedUsers: 0 };

  // Streams: old ones not yet purged (the marker makes later runs skip them).
  for (;;) {
    const batch = await db
      .select({ id: streams.id, userId: streams.userId, title: streams.title, summary: streams.summary })
      .from(streams)
      .where(and(lt(streams.startedAt, cutoff), sql`json_extract(${streams.summary}, '$.youtubePurgedAt') is null`))
      .limit(STREAM_BATCH);
    const live = await purgeStreams(batch, now, result);
    // Live streams stay unmarked and come back in the next batch; stop once nothing else is left.
    if (batch.length < STREAM_BATCH || live === batch.length) {
      break;
    }
  }

  // Per-stream YouTube chatters: by the stream's start, and any row last active before the cutoff.
  result.streamChatters += affected(
    await db.execute(
      sql`delete sc from ${streamChatters} sc join ${streams} s on s.id = sc.stream_id where sc.platform = 'youtube' and s.started_at < ${cutoffSql}`,
    ),
  );
  result.streamChatters += affected(await db.delete(streamChatters).where(and(eq(streamChatters.platform, "youtube"), lt(streamChatters.lastAt, cutoff))));

  // Lifetime YouTube chatters: recount rows that reach back past the cutoff from the last 30
  // days of streams, then delete what has nothing left in that window.
  result.chattersRecounted = affected(
    await db.execute(sql`
      update ${chatters} c
      join (
        select s.user_id, sc.chatter_id, sum(sc.messages) as messages, count(*) as streams, min(sc.first_at) as first_at, max(sc.last_at) as last_at
        from ${streamChatters} sc join ${streams} s on s.id = sc.stream_id
        where sc.platform = 'youtube' and s.started_at >= ${cutoffSql}
        group by s.user_id, sc.chatter_id
      ) w on w.user_id = c.user_id and w.chatter_id = c.chatter_id
      set c.messages = w.messages, c.streams = w.streams, c.first_seen_at = w.first_at, c.last_seen_at = w.last_at
      where c.platform = 'youtube' and c.first_seen_at < ${cutoffSql}
    `),
  );
  result.chattersDeleted = affected(
    await db.delete(chatters).where(and(eq(chatters.platform, "youtube"), or(lt(chatters.firstSeenAt, cutoff), lt(chatters.lastSeenAt, cutoff)))),
  );

  result.loyalty = affected(await db.delete(loyalty).where(and(eq(loyalty.platform, "youtube"), lt(loyalty.updatedAt, cutoff))));

  // Overlay stats and live tools go through their stores, so in-memory copies stay in step.
  for (const { userId } of await db.select({ userId: streamStats.userId }).from(streamStats)) {
    if (await purgeStatsYouTube(userId)) {
      result.stats += 1;
    }
  }
  for (const { userId } of await db.select({ userId: liveTools.userId }).from(liveTools)) {
    if (await liveToolsHub.purgeYouTube(userId)) {
      result.liveTools += 1;
    }
  }

  // Revoked at Google? A token refresh tells; a rejected one marks the connection needs_reauth.
  await checkYouTubeGrants(now, result);

  // The connected channel's own profile from YouTube: refreshed weekly, cleared if it can't be refreshed within 30 days.
  // Revoked (needs_reauth) connections can't be refreshed; the revocation purge below clears them.
  const profiles = await db
    .select({ id: connections.id, profileSyncedAt: connections.profileSyncedAt, avatarUrl: connections.avatarUrl, displayName: connections.displayName })
    .from(connections)
    .where(
      and(
        eq(connections.platform, "youtube"),
        ne(connections.status, "needs_reauth"),
        or(isNull(connections.profileSyncedAt), lt(connections.profileSyncedAt, new Date(now - PROFILE_REFRESH_MS))),
      ),
    );
  for (const profile of profiles) {
    try {
      if (await refreshConnectionProfile(profile.id)) {
        result.profilesRefreshed += 1;
      }
    } catch (error) {
      if (isExpired(profile.profileSyncedAt, now) && (profile.avatarUrl !== null || profile.displayName !== CLEARED_NAME)) {
        await db.update(connections).set({ displayName: CLEARED_NAME, username: "", avatarUrl: null }).where(eq(connections.id, profile.id));
        result.profilesCleared += 1;
      } else {
        console.warn(`[retention] YouTube profile refresh failed for ${profile.id}: ${(error as Error).message}`);
      }
    }
  }

  // Revoked or removed YouTube access: delete everything from YouTube for those users now.
  for (const userId of await usersWithRevokedYouTube()) {
    try {
      await purgeUserYouTubeData(userId);
      result.revokedUsers += 1;
    } catch (error) {
      console.error(`[retention] YouTube purge after revocation failed for ${userId}`, error);
    }
  }
  return result;
}

/**
 * Refreshes the Google token of each active YouTube connection whose stored token is expired or
 * expires within the hour, at most once per connection per hour. Google rejects the refresh
 * (invalid_grant) once the user revoked access, and connections/tokens.ts then marks the
 * connection needs_reauth; network errors and Google outages throw plain errors there and
 * leave the connection active, to be tried again next hour.
 */
async function checkYouTubeGrants(now: number, result: PurgeResult) {
  const rows = await getDb()
    .select({ connection: connections })
    .from(connections)
    .innerJoin(accounts, eq(accounts.id, connections.accountId))
    .where(
      and(
        eq(connections.platform, "youtube"),
        eq(connections.status, "active"),
        or(isNull(accounts.accessTokenExpiresAt), lt(accounts.accessTokenExpiresAt, new Date(now + GRANT_CHECK_WINDOW_MS))),
      ),
    );
  const checked = (globalForRetention.__signalKitYouTubeGrantChecks ??= new Map());
  for (const [id, at] of checked) {
    if (now - at >= EVERY_MS) {
      checked.delete(id);
    }
  }
  for (const { connection } of rows) {
    if (checked.has(connection.id)) {
      continue;
    }
    checked.set(connection.id, now);
    result.grantsChecked += 1;
    try {
      // Expired (or nearly): the getter refreshes. Valid for a while yet: force the refresh, so a
      // revocation is noticed this run rather than the next.
      const [account] = await getDb().select({ expiresAt: accounts.accessTokenExpiresAt }).from(accounts).where(eq(accounts.id, connection.accountId)).limit(1);
      const expiresAt = account?.expiresAt?.getTime();
      if (expiresAt === undefined || expiresAt <= Date.now() + GETTER_REFRESH_WINDOW_MS) {
        await getConnectionAccessToken(connection.id);
      } else {
        await forceRefresh(connection);
      }
    } catch (error) {
      const [current] = error instanceof ConnectionUnavailableError ? await getDb().select({ status: connections.status }).from(connections).where(eq(connections.id, connection.id)).limit(1) : [];
      if (current?.status === "needs_reauth") {
        result.grantsRevoked += 1;
        // Lets the live chat manager drop the connection now instead of at its next sync.
        connectionEvents.emit("changed", connection.id);
      } else {
        console.warn(`[retention] YouTube token check failed for ${connection.id}: ${(error as Error).message}`);
      }
    }
  }
}

const globalForRetention = globalThis as typeof globalThis & { __signalKitYouTubeGrantChecks?: Map<string, number> };

/**
 * Users who have YouTube data stored (or a revoked, needs_reauth YouTube connection with its channel
 * profile or Google tokens still stored) but no active YouTube connection. One query over the tables that can
 * hold YouTube data, each filtered to YouTube rows; users who never connected YouTube have none.
 */
async function usersWithRevokedYouTube() {
  const rows = (await getDb().execute(sql`
    select candidates.user_id from (
      select user_id from ${connections} where platform = 'youtube' and status = 'needs_reauth' and (avatar_url is not null or username <> '' or display_name <> ${CLEARED_NAME})
      union select c.user_id from ${connections} c join ${accounts} a on a.id = c.account_id
        where c.platform = 'youtube' and c.status = 'needs_reauth' and (a.access_token is not null or a.refresh_token is not null or a.id_token is not null)
      union select user_id from ${chatters} where platform = 'youtube'
      union select user_id from ${loyalty} where platform = 'youtube'
      union select user_id from ${events} where platform = 'youtube'
      union select s.user_id from ${streamChatters} sc join ${streams} s on s.id = sc.stream_id where sc.platform = 'youtube'
      union select user_id from ${streams}
        where json_extract(summary, '$.youtubePurgedAt') is null
          and (json_extract(summary, '$.platforms.youtube') is not null or json_search(summary, 'one', 'youtube', null, '$**.platform') is not null)
      union select user_id from ${streamStats}
        where json_length(coalesce(json_extract(state, '$.youtubeDays'), json_object())) > 0
          or json_extract(state, '$.boss.youtubeSince') is not null
          or json_search(state, 'one', 'youtube', null, '$**.platform') is not null
      union select user_id from ${liveTools}
        where json_search(state, 'one', 'youtube', null, '$**.platform') is not null
          or json_search(coalesce(json_keys(json_extract(state, '$.poll.votes')), json_array()), 'one', 'youtube:%') is not null
    ) candidates
    where not exists (select 1 from ${connections} c where c.user_id = candidates.user_id and c.platform = 'youtube' and c.status in ('active', 'error'))
  `)) as unknown as [{ user_id: string }[]];
  return rows[0].map((row) => row.user_id);
}

export type UserPurgeResult = {
  streamsStripped: number;
  streamsDeleted: number;
  streamChatters: number;
  chatters: number;
  loyalty: number;
  events: number;
  stats: boolean;
  liveTools: boolean;
  profilesCleared: number;
  /** Better Auth accounts of revoked YouTube connections whose Google tokens were deleted. */
  tokensDeleted: number;
};

/**
 * Deletes everything Signal Kit stored from YouTube for one user, whatever its age (cutoff: now):
 * the YouTube part of every stream (YouTube-only streams are deleted, live ones included), the
 * user's YouTube stream chatters, chatters and loyalty rows, raw YouTube events, YouTube parts of
 * overlay stats (buckets, names, a session or boss holding YouTube counts) and live tools, and
 * the channel profile and Google tokens of any YouTube connection that is still stored but
 * revoked (needs_reauth; the row keeps only the channel id, for "Reconnect"). Only that user,
 * only YouTube. Used when YouTube is disconnected and when its access was revoked.
 */
export async function purgeUserYouTubeData(userId: string): Promise<UserPurgeResult> {
  const db = getDb();
  const result: UserPurgeResult = { streamsStripped: 0, streamsDeleted: 0, streamChatters: 0, chatters: 0, loyalty: 0, events: 0, stats: false, liveTools: false, profilesCleared: 0, tokensDeleted: 0 };

  // First the live stream in memory, so the tracker's next save can't write YouTube data back.
  await streamTracker.dropYouTube(userId);

  const rows = await db
    .select({ id: streams.id, title: streams.title, summary: streams.summary })
    .from(streams)
    .where(and(eq(streams.userId, userId), sql`json_extract(${streams.summary}, '$.youtubePurgedAt') is null`));
  for (const row of rows) {
    const stripped = stripYouTubeFromSummary(row.summary, row.title);
    if (stripped.empty) {
      await db.delete(streamChatters).where(eq(streamChatters.streamId, row.id));
      await db.delete(streams).where(eq(streams.id, row.id));
      result.streamsDeleted += 1;
    } else if (stripped.changed) {
      await db.update(streams).set({ title: stripped.title, summary: stripped.summary }).where(eq(streams.id, row.id));
      result.streamsStripped += 1;
    }
  }

  result.streamChatters = affected(
    await db.execute(sql`delete sc from ${streamChatters} sc join ${streams} s on s.id = sc.stream_id where sc.platform = 'youtube' and s.user_id = ${userId}`),
  );
  result.chatters = affected(await db.delete(chatters).where(and(eq(chatters.userId, userId), eq(chatters.platform, "youtube"))));
  result.loyalty = affected(await db.delete(loyalty).where(and(eq(loyalty.userId, userId), eq(loyalty.platform, "youtube"))));
  result.events = affected(await db.delete(events).where(and(eq(events.userId, userId), eq(events.platform, "youtube"))));
  result.stats = await purgeStatsYouTube(userId, true);
  result.liveTools = await liveToolsHub.purgeYouTube(userId, true);
  result.profilesCleared = affected(
    await db
      .update(connections)
      .set({ displayName: CLEARED_NAME, username: "", avatarUrl: null })
      .where(and(eq(connections.userId, userId), eq(connections.platform, "youtube"), eq(connections.status, "needs_reauth"))),
  );
  // Revoked grants are useless; reconnecting (or signing in with Google) stores new tokens on the same account.
  const revoked = await db
    .select({ accountId: connections.accountId })
    .from(connections)
    .where(and(eq(connections.userId, userId), eq(connections.platform, "youtube"), eq(connections.status, "needs_reauth")));
  if (revoked.length > 0) {
    result.tokensDeleted = affected(
      await db
        .update(accounts)
        // Keep updatedAt: a newer account makes the connection sync retry the profile on every dashboard load.
        .set({ accessToken: null, refreshToken: null, idToken: null, accessTokenExpiresAt: null, refreshTokenExpiresAt: null, updatedAt: sql`${accounts.updatedAt}` })
        .where(
          and(
            inArray(
              accounts.id,
              revoked.map((row) => row.accountId),
            ),
            or(sql`${accounts.accessToken} is not null`, sql`${accounts.refreshToken} is not null`, sql`${accounts.idToken} is not null`),
          ),
        ),
    );
  }
  return result;
}

/** What a YouTube connection is called once its profile couldn't be refreshed for 30 days. */
const CLEARED_NAME = "YouTube channel";

/** Returns how many of the rows are live streams (stripped in memory, left unmarked). */
async function purgeStreams(rows: { id: string; userId: string; title: string | null; summary: StreamSummary }[], now: number, result: PurgeResult) {
  const db = getDb();
  let live = 0;
  for (const row of rows) {
    // Still live after 30 days: the tracker strips its in-memory copy and saves; the row isn't
    // marked, so later runs strip again until the stream ends.
    if (await streamTracker.stripOldYouTube(row.userId, row.id)) {
      result.streamsStripped += 1;
      live += 1;
      continue;
    }
    const stripped = stripYouTubeFromSummary(row.summary, row.title);
    if (stripped.empty) {
      await db.delete(streamChatters).where(eq(streamChatters.streamId, row.id));
      await db.delete(streams).where(eq(streams.id, row.id));
      result.streamsDeleted += 1;
      continue;
    }
    await db
      .update(streams)
      .set({ title: stripped.title, summary: { ...stripped.summary, youtubePurgedAt: new Date(now).toISOString() } })
      .where(eq(streams.id, row.id));
    if (stripped.changed) {
      result.streamsStripped += 1;
    }
  }
  return live;
}

let timer: NodeJS.Timeout | undefined;

/** Starts the hourly YouTube retention job (first run a minute after start). */
export function startYouTubeRetention() {
  if (timer) {
    return;
  }
  const run = async () => {
    try {
      const started = Date.now();
      const r = await purgeYouTubeData();
      console.log(
        `[retention] YouTube data older than 30 days deleted in ${Date.now() - started} ms: ${r.streamsStripped} streams stripped, ${r.streamsDeleted} YouTube-only streams deleted, ${r.streamChatters} stream chatters, ${r.chattersDeleted} chatters deleted (${r.chattersRecounted} recounted), ${r.loyalty} loyalty rows, ${r.stats} stats, ${r.liveTools} live tools, ${r.profilesRefreshed} YouTube profiles refreshed (${r.profilesCleared} cleared), ${r.grantsChecked} YouTube grants checked (${r.grantsRevoked} revoked), ${r.revokedUsers} users with revoked YouTube access purged`,
      );
    } catch (error) {
      console.error("[retention] YouTube purge failed", error);
    }
  };
  setTimeout(() => void run(), FIRST_RUN_AFTER_MS);
  timer = setInterval(() => void run(), EVERY_MS);
}
