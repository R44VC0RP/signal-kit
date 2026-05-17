import { eq } from "drizzle-orm";
import WebSocket from "ws";
import { getDb } from "@/db";
import { eventSubscriptions, twitchUsers } from "@/db/schema";
import { relayHub } from "@/lib/ws/relay";
import { createEventSubSubscription } from "./api";
import { getUsableAccessToken } from "./tokens";

type TwitchEventSubMessage = {
  metadata?: {
    message_type?: string;
  };
  payload?: {
    session?: {
      id?: string;
      reconnect_url?: string;
    };
    subscription?: {
      id?: string;
      type?: string;
      version?: string;
    };
    event?: unknown;
  };
};

type ManagedConnection = {
  userId: string;
  ws?: WebSocket;
  reconnectTimer?: NodeJS.Timeout;
  sessionId?: string;
  intentionallyClosed?: boolean;
};

class EventSubManager {
  private connections = new Map<string, ManagedConnection>();
  private started = false;

  start() {
    if (this.started || process.env.EVENTSUB_MANAGER_ENABLED === "false") {
      return;
    }
    this.started = true;
    void this.syncAllUsers();
    setInterval(() => void this.syncAllUsers(), 60_000);
  }

  async syncAllUsers() {
    const users = await getDb().select({ id: twitchUsers.id }).from(twitchUsers);
    await Promise.all(users.map((user) => this.ensureUser(user.id)));
  }

  async ensureUser(userId: string) {
    const existing = this.connections.get(userId);
    if (
      existing?.ws &&
      (existing.ws.readyState === WebSocket.CONNECTING || existing.ws.readyState === WebSocket.OPEN)
    ) {
      if (existing.sessionId) {
        await this.subscribeActive(existing.userId, existing.sessionId);
      }
      return;
    }

    const connection: ManagedConnection = existing ?? { userId };
    this.connections.set(userId, connection);
    this.connect(connection, "wss://eventsub.wss.twitch.tv/ws");
  }

  private connect(connection: ManagedConnection, url: string) {
    connection.intentionallyClosed = false;
    const ws = new WebSocket(url);
    connection.ws = ws;

    ws.on("message", (data) => void this.handleMessage(connection, data.toString()));
    ws.on("close", () => {
      if (!connection.intentionallyClosed) {
        this.scheduleReconnect(connection);
      }
    });
    ws.on("error", (error) => {
      console.error(`[eventsub] ${connection.userId} websocket error`, error);
    });
  }

  private async handleMessage(connection: ManagedConnection, rawMessage: string) {
    const message = JSON.parse(rawMessage) as TwitchEventSubMessage;
    const messageType = message.metadata?.message_type;

    if (messageType === "session_welcome") {
      const sessionId = message.payload?.session?.id;
      if (!sessionId) {
        return;
      }
      connection.sessionId = sessionId;
      await this.subscribeActive(connection.userId, sessionId);
      return;
    }

    if (messageType === "session_reconnect") {
      const reconnectUrl = message.payload?.session?.reconnect_url;
      if (reconnectUrl) {
        this.connectReplacement(connection, reconnectUrl);
      }
      return;
    }

    if (messageType === "notification") {
      relayHub.publish(connection.userId, {
        type: message.payload?.subscription?.type ?? "eventsub.notification",
        subscription: message.payload?.subscription,
        event: message.payload?.event,
        receivedAt: new Date().toISOString(),
      });
      return;
    }

    if (messageType === "revocation") {
      const twitchSubscriptionId = message.payload?.subscription?.id;
      if (twitchSubscriptionId) {
        await getDb()
          .update(eventSubscriptions)
          .set({ status: "revoked", error: rawMessage })
          .where(eq(eventSubscriptions.twitchSubscriptionId, twitchSubscriptionId));
      }
    }
  }

  private connectReplacement(connection: ManagedConnection, reconnectUrl: string) {
    const oldWs = connection.ws;
    const replacement = new WebSocket(reconnectUrl);
    replacement.on("message", (data) => {
      const raw = data.toString();
      const message = JSON.parse(raw) as TwitchEventSubMessage;
      if (message.metadata?.message_type === "session_welcome") {
        connection.intentionallyClosed = true;
        oldWs?.close();
        connection.intentionallyClosed = false;
        connection.ws = replacement;
        connection.sessionId = message.payload?.session?.id;
        return;
      }
      void this.handleMessage(connection, raw);
    });
    replacement.on("close", () => this.scheduleReconnect(connection));
    replacement.on("error", (error) => console.error(`[eventsub] ${connection.userId} reconnect error`, error));
  }

  private scheduleReconnect(connection: ManagedConnection) {
    clearTimeout(connection.reconnectTimer);
    connection.reconnectTimer = setTimeout(() => {
      this.connect(connection, "wss://eventsub.wss.twitch.tv/ws");
    }, 5_000);
  }

  private async subscribeActive(userId: string, sessionId: string) {
    const accessToken = await getUsableAccessToken(userId);
    const subscriptions = await getDb()
      .select()
      .from(eventSubscriptions)
      .where(eq(eventSubscriptions.twitchUserId, userId));

    const needsSubscription = subscriptions.filter(
      (subscription) =>
        subscription.status === "desired" ||
        (subscription.status === "enabled" && subscription.twitchSessionId !== sessionId),
    );

    await Promise.all(
      needsSubscription.map(async (subscription) => {
        try {
          const result = await createEventSubSubscription(accessToken, {
            type: subscription.type,
            version: subscription.version,
            condition: subscription.conditionJson,
            sessionId,
          });
          const created = result.data[0];
          await getDb()
            .update(eventSubscriptions)
            .set({
              status: created?.status ?? "enabled",
              twitchSubscriptionId: created?.id,
              twitchSessionId: sessionId,
              error: null,
            })
            .where(eq(eventSubscriptions.id, subscription.id));
        } catch (error) {
          await getDb()
            .update(eventSubscriptions)
            .set({ status: "failed", twitchSessionId: sessionId, error: String(error) })
            .where(eq(eventSubscriptions.id, subscription.id));
        }
      }),
    );
  }
}

const globalForEventSub = globalThis as typeof globalThis & { __signalKitEventSub?: EventSubManager };

export const eventSubManager = globalForEventSub.__signalKitEventSub ?? new EventSubManager();
globalForEventSub.__signalKitEventSub = eventSubManager;
