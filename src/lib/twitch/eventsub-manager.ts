import { and, eq, inArray } from "drizzle-orm";
import WebSocket from "ws";
import { getDb } from "@/db";
import { connections, platformSubscriptions } from "@/db/schema";
import { stableJsonHash } from "@/lib/crypto";
import { connectionEvents } from "@/lib/connections/events";
import { markNeedsReauth } from "@/lib/connections/tokens";
import { type EventSource, ingestEvent } from "@/lib/events/ingest";
import { normalizeTwitch } from "@/lib/events/normalize";
import {
  assignShard,
  createConduitSubscription,
  deleteSubscription,
  ensureConduit,
  HelixError,
  listConduitSubscriptions,
} from "./helix-app";
import { syncDesiredSubscriptionsForConnection } from "./subscriptions";

/**
 * Twitch EventSub over a conduit.
 *
 * Subscriptions belong to the conduit (created with the app token), not to a socket, so they
 * survive restarts and deploys. This process holds one WebSocket attached to one shard; Twitch
 * routes every subscribed channel's events to it. Reconcile keeps Twitch's subscriptions equal
 * to the desired rows in `platform_subscriptions`.
 */

const EVENTSUB_URL = "wss://eventsub.wss.twitch.tv/ws?keepalive_timeout_seconds=30";
const RECONCILE_EVERY_MS = 5 * 60 * 1000;

type Message = {
  metadata?: { message_id?: string; message_type?: string };
  payload?: {
    session?: { id?: string; reconnect_url?: string; keepalive_timeout_seconds?: number };
    subscription?: { id?: string; type?: string; status?: string; condition?: Record<string, string> };
    event?: Record<string, unknown>;
  };
};

class ConduitManager {
  private started = false;
  private conduitId: string | null = null;
  private readonly shardId = process.env.TWITCH_CONDUIT_SHARD_ID ?? "0";

  private ws: WebSocket | null = null;
  private retired = new WeakSet<WebSocket>();
  private keepaliveMs = 30_000;
  private lastMessageAt = 0;
  private reconnectAttempt = 0;
  private reconnectTimer?: NodeJS.Timeout;

  /** Remote subscription id → where its events go. */
  private routes = new Map<string, EventSource>();
  private reconciling = false;
  private reconcileAgain = false;

  start() {
    if (this.started || process.env.EVENTSUB_MANAGER_ENABLED === "false") {
      return;
    }
    this.started = true;
    connectionEvents.on("changed", (connectionId) => void this.connectionChanged(connectionId));
    connectionEvents.on("removed", () => this.reconcileSoon());
    setInterval(() => this.reconcileSoon(), RECONCILE_EVERY_MS);
    setInterval(() => this.checkKeepalive(), 5_000);
    void this.boot();
  }

  /** Current state for diagnostics. */
  status() {
    return {
      conduitId: this.conduitId,
      shardId: this.shardId,
      connected: this.ws?.readyState === WebSocket.OPEN,
      routes: this.routes.size,
    };
  }

  private async boot() {
    try {
      await this.syncAllDesired();
      this.conduitId = await ensureConduit();
      console.log(`[conduit] using conduit ${this.conduitId}, shard ${this.shardId}`);
      this.connect(EVENTSUB_URL);
    } catch (error) {
      console.error("[conduit] boot failed; retrying in 30s", error);
      setTimeout(() => void this.boot(), 30_000);
    }
  }

  // ---- WebSocket shard -------------------------------------------------------------------

  private connect(url: string) {
    const ws = new WebSocket(url);
    ws.on("message", (data) => void this.onMessage(ws, data.toString()));
    ws.on("close", (code) => {
      if (this.retired.has(ws)) {
        return;
      }
      if (ws === this.ws) {
        console.warn(`[conduit] shard socket closed (${code}); reconnecting`);
        this.ws = null;
        this.scheduleReconnect();
      }
    });
    ws.on("error", (error) => console.error("[conduit] socket error", error.message));
    if (!this.ws) {
      this.ws = ws;
    }
  }

  private scheduleReconnect() {
    clearTimeout(this.reconnectTimer);
    const delay = Math.min(30_000, 1000 * 2 ** this.reconnectAttempt) + Math.floor(Math.random() * 500);
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => this.connect(EVENTSUB_URL), delay);
  }

  /** Twitch sends a keepalive at least every `keepalive_timeout_seconds`; silence means a dead socket. */
  private checkKeepalive() {
    if (this.ws?.readyState === WebSocket.OPEN && Date.now() - this.lastMessageAt > this.keepaliveMs + 10_000) {
      console.warn("[conduit] keepalive missed; reconnecting");
      this.ws.terminate();
    }
  }

  private async onMessage(ws: WebSocket, raw: string) {
    let message: Message;
    try {
      message = JSON.parse(raw);
    } catch {
      return;
    }
    if (ws === this.ws) {
      this.lastMessageAt = Date.now();
    }
    const type = message.metadata?.message_type;

    if (type === "session_welcome") {
      await this.onWelcome(ws, message);
      return;
    }
    if (type === "session_reconnect" && message.payload?.session?.reconnect_url) {
      // Open the replacement; the old socket is retired once the new one says welcome.
      const replacement = new WebSocket(message.payload.session.reconnect_url);
      replacement.on("message", (data) => void this.onMessage(replacement, data.toString()));
      replacement.on("close", () => {
        if (!this.retired.has(replacement) && replacement === this.ws) {
          this.ws = null;
          this.scheduleReconnect();
        }
      });
      replacement.on("error", (error) => console.error("[conduit] replacement socket error", error.message));
      return;
    }
    if (type === "notification") {
      await this.onNotification(message);
      return;
    }
    if (type === "revocation") {
      await this.onRevocation(message);
    }
  }

  private async onWelcome(ws: WebSocket, message: Message) {
    const sessionId = message.payload?.session?.id;
    if (!sessionId || !this.conduitId) {
      return;
    }
    if (ws !== this.ws) {
      const old = this.ws;
      this.ws = ws;
      if (old) {
        this.retired.add(old);
        old.close();
      }
    }
    this.keepaliveMs = (message.payload?.session?.keepalive_timeout_seconds ?? 30) * 1000;
    this.lastMessageAt = Date.now();
    try {
      // Must happen within 10 seconds of the welcome or Twitch closes the socket.
      const status = await assignShard(this.conduitId, this.shardId, sessionId);
      this.reconnectAttempt = 0;
      console.log(`[conduit] shard ${this.shardId} attached (${status})`);
      this.reconcileSoon();
    } catch (error) {
      console.error("[conduit] shard assignment failed", error);
      ws.terminate();
    }
  }

  private async onNotification(message: Message) {
    const subscription = message.payload?.subscription;
    const event = message.payload?.event ?? {};
    if (!subscription?.id || !subscription.type) {
      return;
    }
    const source = this.routes.get(subscription.id) ?? (await this.lookupRoute(subscription.id, subscription.condition));
    if (!source) {
      return;
    }
    await ingestEvent(source, {
      rawType: subscription.type,
      raw: event,
      sourceId: `twitch:${message.metadata?.message_id ?? `${subscription.id}:${Date.now()}`}`,
      normalized: normalizeTwitch(subscription.type, event),
    });
  }

  private async onRevocation(message: Message) {
    const subscription = message.payload?.subscription;
    if (!subscription?.id) {
      return;
    }
    const [row] = await getDb()
      .select({ id: platformSubscriptions.id, connectionId: platformSubscriptions.connectionId })
      .from(platformSubscriptions)
      .where(eq(platformSubscriptions.remoteId, subscription.id))
      .limit(1);
    this.routes.delete(subscription.id);
    if (!row) {
      return;
    }
    await getDb()
      .update(platformSubscriptions)
      .set({ status: "revoked", error: subscription.status ?? "revoked" })
      .where(eq(platformSubscriptions.id, row.id));
    if (subscription.status === "authorization_revoked" || subscription.status === "user_removed") {
      const [connection] = await getDb().select().from(connections).where(eq(connections.id, row.connectionId)).limit(1);
      if (connection) {
        await markNeedsReauth(connection.accountId, "Twitch access was revoked. Reconnect Twitch.");
      }
    }
  }

  /** Fallback when a notification arrives before the route map knows its subscription. */
  private async lookupRoute(remoteId: string, condition?: Record<string, string>) {
    const [byRemote] = await getDb()
      .select({ connection: connections })
      .from(platformSubscriptions)
      .innerJoin(connections, eq(connections.id, platformSubscriptions.connectionId))
      .where(eq(platformSubscriptions.remoteId, remoteId))
      .limit(1);
    let connection = byRemote?.connection;
    const broadcasterId = condition?.broadcaster_user_id ?? condition?.to_broadcaster_user_id;
    if (!connection && broadcasterId) {
      [connection] = await getDb()
        .select()
        .from(connections)
        .where(and(eq(connections.platform, "twitch"), eq(connections.platformUserId, broadcasterId)))
        .limit(1);
    }
    if (!connection) {
      return undefined;
    }
    const source = toSource(connection);
    this.routes.set(remoteId, source);
    return source;
  }

  // ---- Reconcile desired rows with Twitch --------------------------------------------------

  private async syncAllDesired() {
    const rows = await getDb()
      .select({ id: connections.id })
      .from(connections)
      .where(and(eq(connections.platform, "twitch"), eq(connections.role, "broadcaster")));
    for (const row of rows) {
      await syncDesiredSubscriptionsForConnection(row.id).catch((error) => console.error(`[conduit] desired sync failed for ${row.id}`, error));
    }
  }

  private async connectionChanged(connectionId: string) {
    const [connection] = await getDb().select().from(connections).where(eq(connections.id, connectionId)).limit(1);
    if (connection?.platform !== "twitch") {
      return;
    }
    if (connection.role === "broadcaster") {
      await syncDesiredSubscriptionsForConnection(connection.id, { resetRevoked: true }).catch((error) =>
        console.error("[conduit] desired sync failed", error),
      );
    } else {
      // Bots don't receive channel events; dropping the rows lets reconcile delete them remotely.
      await getDb().delete(platformSubscriptions).where(eq(platformSubscriptions.connectionId, connection.id));
    }
    this.reconcileSoon();
  }

  reconcileSoon() {
    if (!this.conduitId) {
      return;
    }
    void this.reconcile().catch((error) => console.error("[conduit] reconcile failed", error));
  }

  private async reconcile() {
    if (this.reconciling) {
      this.reconcileAgain = true;
      return;
    }
    this.reconciling = true;
    try {
      const conduitId = this.conduitId!;
      const rows = await getDb()
        .select({ sub: platformSubscriptions, connection: connections })
        .from(platformSubscriptions)
        .innerJoin(connections, eq(connections.id, platformSubscriptions.connectionId))
        .where(and(eq(connections.platform, "twitch"), eq(connections.role, "broadcaster")));
      const remote = await listConduitSubscriptions(conduitId);
      const remoteByKey = new Map(remote.map((sub) => [subscriptionKey(sub.type, sub.version, sub.condition), sub]));
      const keep = new Set<string>();
      const routes = new Map<string, EventSource>();
      let created = 0;
      let failed = 0;

      for (const { sub: row, connection } of rows) {
        const key = subscriptionKey(row.type, row.version, row.conditionJson);
        const existing = remoteByKey.get(key);
        if (existing?.status === "enabled") {
          keep.add(existing.id);
          routes.set(existing.id, toSource(connection));
          if (row.remoteId !== existing.id || row.status !== "enabled") {
            await setRow(row.id, { status: "enabled", remoteId: existing.id, error: null });
          }
          continue;
        }
        if (row.status === "revoked") {
          continue; // Waits for the streamer to reconnect, which resets it to desired.
        }
        try {
          const result = await createConduitSubscription(conduitId, { type: row.type, version: row.version, condition: row.conditionJson });
          keep.add(result.id);
          routes.set(result.id, toSource(connection));
          await setRow(row.id, { status: "enabled", remoteId: result.id, error: null });
          created += 1;
        } catch (error) {
          failed += 1;
          const message = error instanceof HelixError ? error.message : String(error);
          await setRow(row.id, { status: "failed", error: message.slice(0, 1000) });
        }
      }

      // Anything else on our conduit belongs to a removed connection, a bot, or a dropped event type.
      const stale = remote.filter((sub) => !keep.has(sub.id));
      for (const sub of stale) {
        await deleteSubscription(sub.id).catch((error) => console.error(`[conduit] delete ${sub.id} failed`, error));
      }
      this.routes = routes;
      if (created || failed || stale.length) {
        console.log(`[conduit] reconcile: ${routes.size} active, ${created} created, ${failed} failed, ${stale.length} removed`);
      }
    } finally {
      this.reconciling = false;
      if (this.reconcileAgain) {
        this.reconcileAgain = false;
        this.reconcileSoon();
      }
    }
  }
}

/** Twitch echoes conditions with unused fields as "" (e.g. reward_id), so ignore empty values when matching. */
function subscriptionKey(type: string, version: string, condition: Record<string, string>) {
  const meaningful = Object.fromEntries(Object.entries(condition).filter(([, value]) => value !== "" && value != null));
  return `${type}|${version}|${stableJsonHash(meaningful)}`;
}

async function setRow(id: string, values: Partial<typeof platformSubscriptions.$inferInsert>) {
  await getDb().update(platformSubscriptions).set(values).where(inArray(platformSubscriptions.id, [id]));
}

function toSource(connection: typeof connections.$inferSelect): EventSource {
  return {
    connectionId: connection.id,
    userId: connection.userId,
    platform: "twitch",
    platformUserId: connection.platformUserId,
    displayName: connection.displayName,
  };
}

const globalForEventSub = globalThis as typeof globalThis & { __signalKitEventSub?: ConduitManager };

export const eventSubManager = globalForEventSub.__signalKitEventSub ?? new ConduitManager();
globalForEventSub.__signalKitEventSub = eventSubManager;
