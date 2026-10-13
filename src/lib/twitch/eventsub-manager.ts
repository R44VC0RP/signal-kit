import { and, eq } from "drizzle-orm";
import WebSocket from "ws";
import { getDb } from "@/db";
import { connections, platformSubscriptions } from "@/db/schema";
import { connectionEvents } from "@/lib/connections/events";
import { ConnectionUnavailableError, getConnectionAccessToken } from "@/lib/connections/tokens";
import { relayHub } from "@/lib/ws/relay";
import { createEventSubSubscription } from "./api";
import { syncDesiredSubscriptionsForConnection } from "./subscriptions";

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

/** One EventSub WebSocket per Twitch broadcaster connection. */
type ManagedConnection = {
  connectionId: string;
  /** The Twitch user id of the broadcaster. */
  twitchUserId: string;
  /** The SignalKit user whose relay clients receive the events. */
  userId: string;
  ws?: WebSocket;
  reconnectTimer?: NodeJS.Timeout;
  sessionId?: string;
  stopped?: boolean;
};

const EVENTSUB_URL = "wss://eventsub.wss.twitch.tv/ws";

class EventSubManager {
  private connections = new Map<string, ManagedConnection>();
  private suppressedReconnects = new WeakSet<WebSocket>();
  private activeSubscribeJobs = new Set<string>();
  private started = false;

  start() {
    if (this.started || process.env.EVENTSUB_MANAGER_ENABLED === "false") {
      return;
    }
    this.started = true;

    connectionEvents.on("changed", (connectionId) => {
      void this.refreshConnection(connectionId).catch((error) => {
        console.error(`[eventsub] ${connectionId} refresh failed`, error);
      });
    });
    connectionEvents.on("removed", (connectionId) => this.stop(connectionId));

    void this.syncAll().catch((error) => {
      console.error("[eventsub] initial sync failed", error);
    });
    setInterval(() => {
      void this.syncAll().catch((error) => {
        console.error("[eventsub] periodic sync failed", error);
      });
    }, 60_000);
  }

  /** Brings managed sockets in line with active Twitch broadcaster connections in the database. */
  async syncAll() {
    const rows = await getDb()
      .select({ id: connections.id, platformUserId: connections.platformUserId, userId: connections.userId })
      .from(connections)
      .where(
        and(eq(connections.platform, "twitch"), eq(connections.role, "broadcaster"), eq(connections.status, "active")),
      );
    const active = new Set(rows.map((row) => row.id));
    for (const connectionId of this.connections.keys()) {
      if (!active.has(connectionId)) {
        this.stop(connectionId);
      }
    }
    await Promise.all(rows.map((row) => this.ensureConnection(row.id, row.platformUserId, row.userId)));
  }

  /** Re-reads one connection after it changed (linked, relinked, role switched). */
  async refreshConnection(connectionId: string) {
    const [row] = await getDb().select().from(connections).where(eq(connections.id, connectionId)).limit(1);
    if (!row || row.platform !== "twitch" || row.role !== "broadcaster" || row.status !== "active") {
      this.stop(connectionId);
      return;
    }
    await syncDesiredSubscriptionsForConnection(row.id);
    await this.ensureConnection(row.id, row.platformUserId, row.userId);
  }

  async ensureConnection(connectionId: string, twitchUserId: string, userId: string) {
    const existing = this.connections.get(connectionId);
    if (existing) {
      existing.userId = userId;
      existing.stopped = false;
    }
    if (
      existing?.ws &&
      (existing.ws.readyState === WebSocket.CONNECTING || existing.ws.readyState === WebSocket.OPEN)
    ) {
      if (existing.sessionId) {
        await this.subscribeActive(existing, existing.sessionId);
      }
      return;
    }

    const connection: ManagedConnection = existing ?? { connectionId, twitchUserId, userId };
    this.connections.set(connectionId, connection);
    this.connect(connection, EVENTSUB_URL);
  }

  stop(connectionId: string) {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }
    connection.stopped = true;
    clearTimeout(connection.reconnectTimer);
    if (connection.ws) {
      this.suppressedReconnects.add(connection.ws);
      connection.ws.close();
    }
    this.connections.delete(connectionId);
  }

  private connect(connection: ManagedConnection, url: string) {
    const ws = new WebSocket(url);
    connection.ws = ws;

    ws.on("message", (data) => void this.handleMessage(connection, data.toString()));
    ws.on("close", () => {
      if (!this.suppressedReconnects.has(ws)) {
        this.scheduleReconnect(connection);
      }
    });
    ws.on("error", (error) => {
      console.error(`[eventsub] ${connection.connectionId} websocket error`, error);
    });
  }

  private async handleMessage(connection: ManagedConnection, rawMessage: string) {
    const message = parseEventSubMessage(connection.connectionId, rawMessage);
    if (!message) {
      return;
    }
    const messageType = message.metadata?.message_type;

    if (messageType === "session_welcome") {
      const sessionId = message.payload?.session?.id;
      if (!sessionId) {
        return;
      }
      connection.sessionId = sessionId;
      await this.subscribeActive(connection, sessionId);
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
        provider: "twitch",
        account: {
          provider: "twitch",
          providerAccountId: connection.twitchUserId,
          connectionId: connection.connectionId,
        },
        subscription: message.payload?.subscription,
        event: message.payload?.event,
        receivedAt: new Date().toISOString(),
      });
      return;
    }

    if (messageType === "revocation") {
      const remoteId = message.payload?.subscription?.id;
      if (remoteId) {
        await getDb()
          .update(platformSubscriptions)
          .set({ status: "revoked", error: rawMessage })
          .where(eq(platformSubscriptions.remoteId, remoteId));
      }
    }
  }

  private connectReplacement(connection: ManagedConnection, reconnectUrl: string) {
    const oldWs = connection.ws;
    const replacement = new WebSocket(reconnectUrl);
    replacement.on("message", (data) => {
      const raw = data.toString();
      const message = parseEventSubMessage(connection.connectionId, raw);
      if (!message) {
        return;
      }
      if (message.metadata?.message_type === "session_welcome") {
        if (oldWs) {
          this.suppressedReconnects.add(oldWs);
        }
        oldWs?.close();
        connection.ws = replacement;
        connection.sessionId = message.payload?.session?.id;
        return;
      }
      void this.handleMessage(connection, raw);
    });
    replacement.on("close", () => {
      if (!this.suppressedReconnects.has(replacement)) {
        this.scheduleReconnect(connection);
      }
    });
    replacement.on("error", (error) =>
      console.error(`[eventsub] ${connection.connectionId} reconnect error`, error),
    );
  }

  private scheduleReconnect(connection: ManagedConnection) {
    clearTimeout(connection.reconnectTimer);
    if (connection.stopped) {
      return;
    }
    connection.reconnectTimer = setTimeout(() => {
      this.connect(connection, EVENTSUB_URL);
    }, 5_000);
  }

  private async subscribeActive(connection: ManagedConnection, sessionId: string) {
    const jobKey = `${connection.connectionId}:${sessionId}`;
    if (this.activeSubscribeJobs.has(jobKey)) {
      return;
    }

    this.activeSubscribeJobs.add(jobKey);
    try {
      const { accessToken } = await getConnectionAccessToken(connection.connectionId);
      const subscriptions = await getDb()
        .select()
        .from(platformSubscriptions)
        .where(eq(platformSubscriptions.connectionId, connection.connectionId));

      const needsSubscription = subscriptions.filter(
        (subscription) =>
          subscription.status === "desired" ||
          (subscription.status === "enabled" && subscription.transportSessionId !== sessionId),
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
              .update(platformSubscriptions)
              .set({
                status: created?.status ?? "enabled",
                remoteId: created?.id,
                transportSessionId: sessionId,
                error: null,
              })
              .where(eq(platformSubscriptions.id, subscription.id));
          } catch (error) {
            await getDb()
              .update(platformSubscriptions)
              .set({ status: "failed", transportSessionId: sessionId, error: String(error) })
              .where(eq(platformSubscriptions.id, subscription.id));
          }
        }),
      );
    } catch (error) {
      if (error instanceof ConnectionUnavailableError) {
        // The user has to reconnect; keep the socket closed until the connection is active again.
        console.warn(`[eventsub] ${connection.connectionId} paused: ${error.message}`);
        this.stop(connection.connectionId);
        return;
      }
      console.error(`[eventsub] ${connection.connectionId} subscribe failed`, error);
    } finally {
      this.activeSubscribeJobs.delete(jobKey);
    }
  }
}

function parseEventSubMessage(connectionId: string, rawMessage: string) {
  try {
    return JSON.parse(rawMessage) as TwitchEventSubMessage;
  } catch (error) {
    console.warn(`[eventsub] ${connectionId} received invalid JSON`, error);
    return null;
  }
}

const globalForEventSub = globalThis as typeof globalThis & { __signalKitEventSub?: EventSubManager };

export const eventSubManager = globalForEventSub.__signalKitEventSub ?? new EventSubManager();
globalForEventSub.__signalKitEventSub = eventSubManager;
