import { and, eq } from "drizzle-orm";
import type { ServiceError } from "@grpc/grpc-js";
import { getDb } from "@/db";
import { connections } from "@/db/schema";
import { connectionEvents } from "@/lib/connections/events";
import { ConnectionUnavailableError, forceRefresh, getConnection, getConnectionAccessToken } from "@/lib/connections/tokens";
import { type EventSource, ingestEvent } from "@/lib/events/ingest";
import { normalizeYouTube } from "@/lib/events/normalize";
import { listActiveLiveBroadcasts, type YouTubeLiveChatMessage } from "./api";
import { GrpcStatus, openLiveChatStream, type StreamListResponse } from "./stream-list";

/**
 * YouTube live chat for every connected channel.
 *
 * While a channel is offline we look for an active broadcast every couple of minutes
 * (liveBroadcasts.list, 1 quota unit). Once live, chat arrives over a streamList gRPC stream
 * that we resume with the last page token, so reconnects neither miss nor repeat messages.
 */

const DISCOVERY_EVERY_MS = 2 * 60 * 1000;

type Managed = {
  connectionId: string;
  source: EventSource;
  liveChatId?: string;
  pageToken?: string;
  /** The first response after opening a brand-new chat is history from before we joined. */
  skipBacklog: boolean;
  stream?: { cancel: () => void };
  retryTimer?: NodeJS.Timeout;
  attempt: number;
  discovering: boolean;
};

class YouTubeLiveManager {
  private managed = new Map<string, Managed>();
  private started = false;

  start() {
    if (this.started || process.env.YOUTUBE_MANAGER_ENABLED === "false") {
      return;
    }
    this.started = true;
    connectionEvents.on("changed", () => void this.syncAll());
    connectionEvents.on("removed", (connectionId) => this.remove(connectionId));
    setInterval(() => void this.syncAll(), DISCOVERY_EVERY_MS);
    void this.syncAll();
  }

  status() {
    return [...this.managed.values()].map((m) => ({ connectionId: m.connectionId, liveChatId: m.liveChatId ?? null, streaming: Boolean(m.stream) }));
  }

  private async syncAll() {
    try {
      const rows = await getDb()
        .select()
        .from(connections)
        .where(and(eq(connections.platform, "youtube"), eq(connections.status, "active")));
      const active = new Set(rows.map((row) => row.id));
      for (const id of this.managed.keys()) {
        if (!active.has(id)) {
          this.remove(id);
        }
      }
      for (const row of rows) {
        const existing = this.managed.get(row.id);
        const source: EventSource = { connectionId: row.id, userId: row.userId, platform: "youtube", platformUserId: row.platformUserId, displayName: row.displayName };
        if (existing) {
          existing.source = source;
        } else {
          this.managed.set(row.id, { connectionId: row.id, source, skipBacklog: true, attempt: 0, discovering: false });
        }
        void this.discover(this.managed.get(row.id)!);
      }
    } catch (error) {
      console.error("[youtube] sync failed", error);
    }
  }

  private remove(connectionId: string) {
    const m = this.managed.get(connectionId);
    if (m) {
      this.closeChat(m);
      this.managed.delete(connectionId);
    }
  }

  /** Find the channel's active broadcast and open its chat stream. Skipped while already streaming. */
  private async discover(m: Managed) {
    if (m.stream || m.discovering || m.retryTimer) {
      return;
    }
    m.discovering = true;
    try {
      const { accessToken } = await getConnectionAccessToken(m.connectionId);
      const broadcasts = await listActiveLiveBroadcasts(accessToken);
      const liveChatId = broadcasts.find((broadcast) => broadcast.snippet?.liveChatId)?.snippet?.liveChatId;
      if (!liveChatId) {
        return;
      }
      if (liveChatId !== m.liveChatId) {
        m.liveChatId = liveChatId;
        m.pageToken = undefined;
        m.skipBacklog = true;
      }
      await this.open(m);
    } catch (error) {
      this.handleTokenError(m, error);
    } finally {
      m.discovering = false;
    }
  }

  private async open(m: Managed) {
    if (!m.liveChatId || m.stream) {
      return;
    }
    const { accessToken } = await getConnectionAccessToken(m.connectionId);
    const liveChatId = m.liveChatId;
    m.stream = openLiveChatStream({
      accessToken,
      liveChatId,
      pageToken: m.pageToken,
      onResponse: (response) => void this.onResponse(m, liveChatId, response),
      onError: (error) => this.onStreamError(m, error),
      // Streams end on their own (e.g. token lifetime); resume right away from the page token.
      onEnd: () => {
        m.stream = undefined;
        this.retry(m, 0);
      },
    });
  }

  private async onResponse(m: Managed, liveChatId: string, response: StreamListResponse) {
    if (m.liveChatId !== liveChatId) {
      return;
    }
    m.attempt = 0;
    if (response.nextPageToken) {
      m.pageToken = response.nextPageToken;
    }
    const backlog = m.skipBacklog;
    m.skipBacklog = false;
    if (!backlog) {
      for (const item of response.items ?? []) {
        await this.ingest(m, item);
      }
    }
    if (response.offlineAt) {
      this.closeChat(m);
    }
  }

  private async ingest(m: Managed, item: YouTubeLiveChatMessage) {
    const type = item.snippet?.type ?? "unknown";
    // Gift events reuse their id for combo updates; include the count so each update is kept.
    const combo = (item.snippet as { giftDetails?: { comboCount?: number } } | undefined)?.giftDetails?.comboCount;
    await ingestEvent(m.source, {
      rawType: `youtube.live_chat.${type}`,
      raw: item,
      sourceId: `youtube:${item.id}${combo ? `:${combo}` : ""}`,
      normalized: normalizeYouTube(item),
    });
  }

  private onStreamError(m: Managed, error: ServiceError) {
    m.stream = undefined;
    switch (error.code) {
      case GrpcStatus.CANCELLED:
        return; // We closed it.
      case GrpcStatus.FAILED_PRECONDITION: // chat ended or disabled
      case GrpcStatus.NOT_FOUND:
        this.closeChat(m);
        return;
      case GrpcStatus.UNAUTHENTICATED:
        void this.refreshAndRetry(m);
        return;
      case GrpcStatus.RESOURCE_EXHAUSTED: // quota or requesting too fast
        console.warn(`[youtube] ${m.connectionId} rate limited: ${error.details}`);
        this.retry(m, 60_000);
        return;
      case GrpcStatus.PERMISSION_DENIED:
        console.warn(`[youtube] ${m.connectionId} permission denied: ${error.details}`);
        this.closeChat(m);
        return;
      default:
        console.warn(`[youtube] ${m.connectionId} stream error ${error.code}: ${error.details}`);
        this.retry(m, Math.min(60_000, 2000 * 2 ** m.attempt));
        m.attempt += 1;
    }
  }

  private async refreshAndRetry(m: Managed) {
    try {
      const connection = await getConnection(m.connectionId);
      if (connection) {
        await forceRefresh(connection);
      }
      this.retry(m, 1000);
    } catch (error) {
      this.handleTokenError(m, error);
    }
  }

  private retry(m: Managed, delayMs: number) {
    clearTimeout(m.retryTimer);
    m.retryTimer = setTimeout(() => {
      m.retryTimer = undefined;
      void this.open(m).catch((error) => this.handleTokenError(m, error));
    }, delayMs);
  }

  private closeChat(m: Managed) {
    clearTimeout(m.retryTimer);
    m.retryTimer = undefined;
    m.stream?.cancel();
    m.stream = undefined;
    m.liveChatId = undefined;
    m.pageToken = undefined;
  }

  private handleTokenError(m: Managed, error: unknown) {
    if (error instanceof ConnectionUnavailableError) {
      // Needs the user to reconnect; syncAll picks it up again once it's active.
      console.warn(`[youtube] ${m.connectionId} paused: ${error.message}`);
      this.remove(m.connectionId);
      return;
    }
    console.error(`[youtube] ${m.connectionId} error`, error);
  }
}

const globalForYouTube = globalThis as typeof globalThis & { __signalKitYouTube?: YouTubeLiveManager };

export const youtubeLiveManager = globalForYouTube.__signalKitYouTube ?? new YouTubeLiveManager();
globalForYouTube.__signalKitYouTube = youtubeLiveManager;
