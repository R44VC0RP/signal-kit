import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { connections } from "@/db/schema";
import { connectionEvents } from "@/lib/connections/events";
import { ConnectionUnavailableError, getConnectionAccessToken } from "@/lib/connections/tokens";
import { relayHub } from "@/lib/ws/relay";
import {
  listActiveLiveBroadcasts,
  listLiveChatMessages,
  type YouTubeLiveBroadcast,
  type YouTubeLiveChatMessage,
  YouTubeApiError,
} from "./api";

type ManagedYouTubeAccount = {
  accountId: string;
  currentLiveChatId?: string;
  currentBroadcast?: YouTubeLiveBroadcast;
  nextPageToken?: string;
  initialized: boolean;
  seenMessageIds: Set<string>;
  pollTimer?: NodeJS.Timeout;
};

class YouTubeLiveManager {
  private accounts = new Map<string, ManagedYouTubeAccount>();
  private activeDiscoveryJobs = new Set<string>();
  private activePollJobs = new Set<string>();
  private started = false;

  start() {
    if (this.started || process.env.YOUTUBE_MANAGER_ENABLED === "false") {
      return;
    }

    this.started = true;
    connectionEvents.on("changed", (connectionId) => {
      void this.syncAllAccounts().catch((error) => {
        console.error(`[youtube] sync after ${connectionId} changed failed`, error);
      });
    });
    connectionEvents.on("removed", (connectionId) => this.removeAccount(connectionId));
    void this.syncAllAccounts().catch((error) => {
      console.error("[youtube] initial sync failed", error);
    });
    setInterval(() => {
      void this.syncAllAccounts().catch((error) => {
        console.error("[youtube] periodic sync failed", error);
      });
    }, 60_000);
  }

  async syncAllAccounts() {
    const rows = await getDb()
      .select({ id: connections.id })
      .from(connections)
      .where(and(eq(connections.platform, "youtube"), eq(connections.status, "active")));
    const active = new Set(rows.map((row) => row.id));
    for (const connectionId of this.accounts.keys()) {
      if (!active.has(connectionId)) {
        this.removeAccount(connectionId);
      }
    }
    await Promise.all(rows.map((row) => this.ensureAccount(row.id)));
  }

  removeAccount(connectionId: string) {
    const managed = this.accounts.get(connectionId);
    if (managed) {
      this.stopPolling(managed);
      this.accounts.delete(connectionId);
    }
  }

  async ensureAccount(accountId: string) {
    const existing = this.accounts.get(accountId);
    if (!existing) {
      this.accounts.set(accountId, {
        accountId,
        initialized: false,
        seenMessageIds: new Set(),
      });
    }
    await this.discoverLiveChat(accountId);
  }

  private async discoverLiveChat(accountId: string) {
    if (this.activeDiscoveryJobs.has(accountId)) {
      return;
    }

    this.activeDiscoveryJobs.add(accountId);
    try {
      const managed = this.accounts.get(accountId);
      if (!managed) {
        return;
      }

      const { accessToken } = await getConnectionAccessToken(accountId);
      const broadcasts = await listActiveLiveBroadcasts(accessToken);
      const broadcast = broadcasts.find((item) => item.snippet?.liveChatId);

      if (!broadcast?.snippet?.liveChatId) {
        this.stopPolling(managed);
        return;
      }

      if (managed.currentLiveChatId === broadcast.snippet.liveChatId) {
        return;
      }

      this.startPolling(managed, broadcast);
    } catch (error) {
      await this.markError(accountId, error);
    } finally {
      this.activeDiscoveryJobs.delete(accountId);
    }
  }

  private startPolling(managed: ManagedYouTubeAccount, broadcast: YouTubeLiveBroadcast) {
    this.stopPolling(managed);
    managed.currentBroadcast = broadcast;
    managed.currentLiveChatId = broadcast.snippet?.liveChatId;
    managed.nextPageToken = undefined;
    managed.initialized = false;
    managed.seenMessageIds = new Set();
    if (managed.currentLiveChatId) {
      this.schedulePoll(managed, 0);
    }
  }

  private stopPolling(managed: ManagedYouTubeAccount) {
    clearTimeout(managed.pollTimer);
    managed.currentBroadcast = undefined;
    managed.currentLiveChatId = undefined;
    managed.nextPageToken = undefined;
    managed.initialized = false;
    managed.seenMessageIds.clear();
  }

  private schedulePoll(managed: ManagedYouTubeAccount, delayMs: number) {
    clearTimeout(managed.pollTimer);
    managed.pollTimer = setTimeout(() => {
      void this.pollLiveChat(managed.accountId).catch((error) => {
        console.error(`[youtube] ${managed.accountId} live chat poll failed`, error);
      });
    }, delayMs);
  }

  private async pollLiveChat(accountId: string) {
    if (this.activePollJobs.has(accountId)) {
      return;
    }

    const managed = this.accounts.get(accountId);
    if (!managed?.currentLiveChatId) {
      return;
    }

    this.activePollJobs.add(accountId);
    try {
      const { accessToken, connection: account } = await getConnectionAccessToken(accountId);
      const response = await listLiveChatMessages(
        accessToken,
        managed.currentLiveChatId,
        managed.nextPageToken,
      );

      const items = response.items ?? [];
      let delivered = 0;

      for (const item of items) {
        if (managed.seenMessageIds.has(item.id)) {
          continue;
        }
        managed.seenMessageIds.add(item.id);
        if (!managed.initialized) {
          continue;
        }
        delivered += relayHub.publish(account.userId, {
          type: eventTypeForMessage(item),
          provider: "youtube",
          account: relayAccount(account),
          subscription: {
            type: "youtube.live_chat",
            liveChatId: managed.currentLiveChatId,
            broadcastId: managed.currentBroadcast?.id,
          },
          event: item,
          receivedAt: new Date().toISOString(),
        });
      }

      managed.initialized = true;
      managed.nextPageToken = response.nextPageToken ?? managed.nextPageToken;
      pruneSeenIds(managed.seenMessageIds);

      if (delivered > 0) {
        await getDb().update(connections).set({ lastEventAt: new Date() }).where(eq(connections.id, accountId));
      }

      if (response.offlineAt) {
        relayHub.publish(account.userId, {
          type: "youtube.live_chat.ended",
          provider: "youtube",
          account: relayAccount(account),
          subscription: {
            type: "youtube.live_chat",
            liveChatId: managed.currentLiveChatId,
            broadcastId: managed.currentBroadcast?.id,
          },
          event: { offlineAt: response.offlineAt, broadcast: managed.currentBroadcast },
          receivedAt: new Date().toISOString(),
        });
        this.stopPolling(managed);
        return;
      }

      this.schedulePoll(managed, Math.max(response.pollingIntervalMillis ?? 5_000, 1_000));
    } catch (error) {
      await this.markError(accountId, error);
      if (isTerminalLiveChatError(error)) {
        this.stopPolling(managed);
      } else {
        this.schedulePoll(managed, 30_000);
      }
    } finally {
      this.activePollJobs.delete(accountId);
    }
  }

  private async markError(connectionId: string, error: unknown) {
    if (error instanceof ConnectionUnavailableError) {
      // Needs the user to reconnect; the periodic sync skips it until it is active again.
      console.warn(`[youtube] ${connectionId} paused: ${error.message}`);
      this.removeAccount(connectionId);
      return;
    }
    console.error(`[youtube] ${connectionId} live chat error`, error);
  }
}

function eventTypeForMessage(message: YouTubeLiveChatMessage) {
  switch (message.snippet?.type) {
    case "textMessageEvent":
      return "youtube.live_chat.message";
    case "superChatEvent":
      return "youtube.live_chat.super_chat";
    case "superStickerEvent":
      return "youtube.live_chat.super_sticker";
    case "newSponsorEvent":
      return "youtube.live_chat.new_sponsor";
    case "memberMilestoneChatEvent":
      return "youtube.live_chat.member_milestone";
    case "membershipGiftingEvent":
      return "youtube.live_chat.membership_gifting";
    case "giftMembershipReceivedEvent":
      return "youtube.live_chat.gift_membership_received";
    case "userBannedEvent":
      return "youtube.live_chat.user_banned";
    case "messageDeletedEvent":
      return "youtube.live_chat.message_deleted";
    case "chatEndedEvent":
      return "youtube.live_chat.ended";
    case "sponsorOnlyModeStartedEvent":
      return "youtube.live_chat.sponsor_only_started";
    case "sponsorOnlyModeEndedEvent":
      return "youtube.live_chat.sponsor_only_ended";
    default:
      return `youtube.live_chat.${message.snippet?.type ?? "event"}`;
  }
}

function relayAccount(connection: { id: string; platformUserId: string; username: string; displayName: string }) {
  return {
    id: connection.id,
    connectionId: connection.id,
    provider: "youtube",
    providerAccountId: connection.platformUserId,
    login: connection.username,
    displayName: connection.displayName,
  };
}

function pruneSeenIds(ids: Set<string>) {
  if (ids.size <= 5_000) {
    return;
  }
  for (const id of ids) {
    ids.delete(id);
    if (ids.size <= 4_000) {
      return;
    }
  }
}

function isTerminalLiveChatError(error: unknown) {
  if (!(error instanceof YouTubeApiError)) {
    return false;
  }
  return ["liveChatEnded", "liveChatDisabled", "liveChatNotFound"].includes(error.reason ?? "");
}

const globalForYouTube = globalThis as typeof globalThis & { __signalKitYouTube?: YouTubeLiveManager };

export const youtubeLiveManager = globalForYouTube.__signalKitYouTube ?? new YouTubeLiveManager();
globalForYouTube.__signalKitYouTube = youtubeLiveManager;
