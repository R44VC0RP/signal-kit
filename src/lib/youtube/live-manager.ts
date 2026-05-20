import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { connectedAccounts } from "@/db/schema";
import { relayHub } from "@/lib/ws/relay";
import {
  listActiveLiveBroadcasts,
  listLiveChatMessages,
  type YouTubeLiveBroadcast,
  type YouTubeLiveChatMessage,
  YouTubeApiError,
} from "./api";
import { getUsableYouTubeAccessToken } from "./tokens";

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
    const accounts = await getDb()
      .select({ id: connectedAccounts.id })
      .from(connectedAccounts)
      .where(eq(connectedAccounts.provider, "youtube"));
    await Promise.all(accounts.map((account) => this.ensureAccount(account.id)));
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

      const accessToken = await getUsableYouTubeAccessToken(accountId);
      const broadcasts = await listActiveLiveBroadcasts(accessToken);
      const broadcast = broadcasts.find((item) => item.snippet?.liveChatId);

      await getDb()
        .update(connectedAccounts)
        .set({ lastSyncAt: new Date(), lastError: null })
        .where(eq(connectedAccounts.id, accountId));

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
      const [account] = await getDb()
        .select()
        .from(connectedAccounts)
        .where(eq(connectedAccounts.id, accountId))
        .limit(1);
      if (!account) {
        this.stopPolling(managed);
        return;
      }

      const accessToken = await getUsableYouTubeAccessToken(accountId);
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
        delivered += relayHub.publish(account.ownerTwitchUserId, {
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

      await getDb()
        .update(connectedAccounts)
        .set({
          lastSyncAt: new Date(),
          lastEventAt: delivered > 0 ? new Date() : account.lastEventAt,
          lastError: null,
        })
        .where(eq(connectedAccounts.id, accountId));

      if (response.offlineAt) {
        relayHub.publish(account.ownerTwitchUserId, {
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

  private async markError(accountId: string, error: unknown) {
    await getDb()
      .update(connectedAccounts)
      .set({ lastSyncAt: new Date(), lastError: String(error) })
      .where(eq(connectedAccounts.id, accountId));
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

function relayAccount(account: {
  id: string;
  provider: string;
  providerAccountId: string;
  login: string;
  displayName: string;
}) {
  return {
    id: account.id,
    provider: account.provider,
    providerAccountId: account.providerAccountId,
    login: account.login,
    displayName: account.displayName,
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
