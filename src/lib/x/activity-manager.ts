import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { connections } from "@/db/schema";
import { getAppUrl } from "@/lib/app-url";
import { xLivestreamEnabled } from "@/lib/auth/scopes";
import { connectionEvents } from "@/lib/connections/events";
import { ConnectionUnavailableError, getConnectionAccessToken, markNeedsReauth } from "@/lib/connections/tokens";
import { type EventSource, ingestEvent } from "@/lib/events/ingest";
import { normalizeX } from "@/lib/events/normalize";

/**
 * X live events through the X Activity API.
 *
 * Like the Twitch conduit: subscriptions belong to the app (created per creator with their own
 * user token, since broadcast chat and subscriptions are private events), and this process
 * holds one persistent HTTP stream (GET /2/activity/stream, app bearer token) that delivers
 * every subscribed event. Reconcile keeps X's subscriptions equal to what active X
 * connections need. Dev and production share the X app, so every subscription is tagged
 * with this deployment's host and only those are managed here.
 */

const API = "https://api.x.com/2";
const RECONCILE_EVERY_MS = 10 * 60 * 1000;
/** X sends keep-alive newlines; this long without any bytes means the stream is dead. */
const STALL_MS = 90_000;

type Wanted = { eventType: string; direction?: "inbound"; scope: string };

/** What a creator's overlay needs from X, and the scope each event requires. */
const WANTED: Wanted[] = [
  { eventType: "broadcast.chat", scope: "broadcast.read" },
  { eventType: "broadcast.chat.remove", scope: "broadcast.read" },
  { eventType: "broadcast.start", scope: "tweet.read" },
  { eventType: "broadcast.end", scope: "tweet.read" },
  { eventType: "follow.follow", direction: "inbound", scope: "tweet.read" },
  { eventType: "subscriptions.subscribe", direction: "inbound", scope: "follows.read" },
];

type RemoteSubscription = {
  subscription_id: string;
  event_type: string;
  filter?: { user_id?: string; direction?: string };
  tag?: string;
};

type Envelope = {
  data?: {
    event_uuid?: string;
    created_at?: string;
    event_type?: string;
    filter?: { user_id?: string };
    payload?: Record<string, unknown>;
  };
};

class XActivityManager {
  private started = false;
  private tag = "";
  private reconciling = false;
  private reconcileAgain = false;
  private hasSubscriptions = false;

  private stream: AbortController | null = null;
  private lastByteAt = 0;
  private everConnected = false;
  private attempt = 0;
  private reconnectTimer?: NodeJS.Timeout;
  private warned = new Set<string>();

  start() {
    if (this.started || process.env.X_ACTIVITY_ENABLED === "false" || !xLivestreamEnabled()) {
      return;
    }
    if (!process.env.X_BEARER_TOKEN) {
      console.warn("[x] X_BEARER_TOKEN is not set; X live events are disabled");
      return;
    }
    this.started = true;
    this.tag = `signalkit:${new URL(getAppUrl()).host}`;
    connectionEvents.on("changed", () => this.reconcileSoon());
    connectionEvents.on("removed", () => this.reconcileSoon());
    setInterval(() => this.reconcileSoon(), RECONCILE_EVERY_MS);
    setInterval(() => this.checkStall(), 15_000);
    this.reconcileSoon();
  }

  status() {
    return { tag: this.tag, streaming: Boolean(this.stream), hasSubscriptions: this.hasSubscriptions };
  }

  // ---- Subscriptions ----------------------------------------------------------------------

  reconcileSoon() {
    if (!this.started) {
      return;
    }
    void this.reconcile().catch((error) => console.error("[x] reconcile failed", error));
  }

  private async reconcile() {
    if (this.reconciling) {
      this.reconcileAgain = true;
      return;
    }
    this.reconciling = true;
    try {
      const rows = await getDb()
        .select()
        .from(connections)
        .where(and(eq(connections.platform, "x"), eq(connections.status, "active")));
      const remote = (await this.listSubscriptions()).filter((sub) => sub.tag === this.tag);
      const remoteKeys = new Map(remote.map((sub) => [key(sub.event_type, sub.filter?.user_id, sub.filter?.direction), sub]));
      const keep = new Set<string>();
      let created = 0;

      for (const row of rows) {
        const scopes = new Set(row.scopes);
        for (const want of WANTED) {
          if (!scopes.has(want.scope)) {
            continue;
          }
          const k = key(want.eventType, row.platformUserId, want.direction);
          const existing = remoteKeys.get(k);
          if (existing) {
            keep.add(existing.subscription_id);
            continue;
          }
          if (await this.createSubscription(row.id, row.platformUserId, want)) {
            created += 1;
          }
        }
      }

      const stale = remote.filter((sub) => !keep.has(sub.subscription_id));
      for (const sub of stale) {
        await this.appRequest("DELETE", `/activity/subscriptions/${encodeURIComponent(sub.subscription_id)}`).catch((error) =>
          console.error(`[x] delete subscription ${sub.subscription_id} failed`, error),
        );
      }
      this.hasSubscriptions = keep.size + created > 0;
      if (created || stale.length) {
        console.log(`[x] reconcile: ${keep.size + created} active, ${created} created, ${stale.length} removed`);
      }
      if (this.hasSubscriptions && !this.stream && !this.reconnectTimer) {
        this.connect();
      }
    } finally {
      this.reconciling = false;
      if (this.reconcileAgain) {
        this.reconcileAgain = false;
        this.reconcileSoon();
      }
    }
  }

  private async createSubscription(connectionId: string, userId: string, want: Wanted) {
    let token: string;
    try {
      ({ accessToken: token } = await getConnectionAccessToken(connectionId));
    } catch (error) {
      if (!(error instanceof ConnectionUnavailableError)) {
        console.error(`[x] token for ${connectionId} failed`, error);
      }
      return false;
    }
    const response = await fetch(`${API}/activity/subscriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        event_type: want.eventType,
        filter: { user_id: userId, ...(want.direction ? { direction: want.direction } : {}) },
        tag: this.tag,
      }),
    });
    if (response.ok || response.status === 409) {
      return response.ok;
    }
    const text = await response.text();
    const warnKey = `${connectionId}:${want.eventType}:${response.status}`;
    if (!this.warned.has(warnKey)) {
      this.warned.add(warnKey);
      console.warn(`[x] subscribe ${want.eventType} for ${connectionId} failed (${response.status}): ${text.slice(0, 300)}`);
    }
    return false;
  }

  private async listSubscriptions() {
    const all: RemoteSubscription[] = [];
    let next: string | undefined;
    do {
      const page = (await this.appRequest(
        "GET",
        `/activity/subscriptions?max_results=100${next ? `&pagination_token=${encodeURIComponent(next)}` : ""}`,
      )) as { data?: RemoteSubscription[]; meta?: { next_token?: string } };
      all.push(...(page.data ?? []));
      next = page.meta?.next_token;
    } while (next);
    return all;
  }

  private async appRequest(method: string, path: string) {
    const response = await fetch(`${API}${path}`, { method, headers: { Authorization: `Bearer ${process.env.X_BEARER_TOKEN}` } });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`X ${method} ${path.split("?")[0]} failed (${response.status}): ${text.slice(0, 300)}`);
    }
    return text ? JSON.parse(text) : {};
  }

  // ---- Stream -----------------------------------------------------------------------------

  private connect() {
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = undefined;
    const controller = new AbortController();
    this.stream = controller;
    this.lastByteAt = Date.now();
    // After a drop, ask for the last few minutes again; event ids dedupe anything seen twice.
    const url = `${API}/activity/stream${this.everConnected ? "?backfill_minutes=5" : ""}`;
    void (async () => {
      const response = await fetch(url, { headers: { Authorization: `Bearer ${process.env.X_BEARER_TOKEN}` }, signal: controller.signal });
      if (!response.ok || !response.body) {
        const text = await response.text().catch(() => "");
        // 409: no subscriptions yet; 429: too many connections or requests.
        const delay = response.status === 409 || response.status === 429 ? 60_000 : this.backoff();
        console.warn(`[x] stream rejected (${response.status}): ${text.slice(0, 200)}; retrying in ${Math.round(delay / 1000)}s`);
        this.scheduleReconnect(controller, delay);
        return;
      }
      console.log("[x] activity stream connected");
      this.everConnected = true;
      this.attempt = 0;
      const decoder = new TextDecoder();
      let buffer = "";
      for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
        this.lastByteAt = Date.now();
        buffer += decoder.decode(chunk, { stream: true });
        let newline: number;
        while ((newline = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          if (line) {
            await this.onLine(line);
          }
        }
      }
      console.warn("[x] activity stream ended; reconnecting");
      this.scheduleReconnect(controller, this.backoff());
    })().catch((error: unknown) => {
      if (!controller.signal.aborted || this.stream === controller) {
        console.warn("[x] activity stream error; reconnecting", error instanceof Error ? error.message : error);
      }
      this.scheduleReconnect(controller, this.backoff());
    });
  }

  private scheduleReconnect(controller: AbortController, delay: number) {
    if (this.stream !== controller) {
      return;
    }
    this.stream = null;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      if (this.hasSubscriptions) {
        this.connect();
      }
    }, delay);
  }

  private backoff() {
    const delay = Math.min(60_000, 1000 * 2 ** this.attempt) + Math.floor(Math.random() * 500);
    this.attempt += 1;
    return delay;
  }

  private checkStall() {
    if (this.stream && Date.now() - this.lastByteAt > STALL_MS) {
      console.warn("[x] activity stream stalled; reconnecting");
      const controller = this.stream;
      controller.abort();
      this.scheduleReconnect(controller, 1000);
    }
  }

  private async onLine(line: string) {
    let envelope: Envelope;
    try {
      envelope = JSON.parse(line);
    } catch {
      return;
    }
    const event = envelope.data;
    const type = event?.event_type;
    if (!event || !type) {
      return;
    }
    const payload = (event.payload ?? {}) as Record<string, unknown>;

    if (type === "oauth.revoke") {
      const userId = String(payload.user_id ?? "");
      for (const row of await this.connectionsFor(userId)) {
        await markNeedsReauth(row.accountId, "X access was revoked. Reconnect X.");
      }
      this.reconcileSoon();
      return;
    }

    const userId = event.filter?.user_id;
    if (!userId) {
      return;
    }
    // Inbound follows/subscriptions only: the creator gaining a follower, not following someone.
    if ((type === "follow.follow" || type === "subscriptions.subscribe") && targetId(payload) && targetId(payload) !== userId) {
      return;
    }
    const normalized = normalizeX(type, payload);
    if (event.created_at && !normalized.occurredAt) {
      normalized.occurredAt = event.created_at;
    }
    for (const row of await this.connectionsFor(userId)) {
      const source: EventSource = {
        connectionId: row.id,
        userId: row.userId,
        platform: "x",
        platformUserId: row.platformUserId,
        displayName: row.displayName,
      };
      await ingestEvent(source, {
        rawType: `x.${type}`,
        raw: payload,
        // Several Signal Kit users can connect the same X account; each gets its own copy.
        sourceId: `x:${event.event_uuid ?? `${type}:${Date.now()}`}:${row.id}`,
        normalized,
      });
    }
  }

  private async connectionsFor(platformUserId: string) {
    if (!platformUserId) {
      return [];
    }
    return getDb()
      .select()
      .from(connections)
      .where(and(eq(connections.platform, "x"), eq(connections.platformUserId, platformUserId), eq(connections.status, "active")));
  }
}

function key(eventType: string, userId?: string, direction?: string) {
  return `${eventType}|${userId ?? ""}|${direction ?? ""}`;
}

function targetId(payload: Record<string, unknown>) {
  const target = payload.target as { data?: { id?: string } } | undefined;
  return target?.data?.id;
}

const globalForX = globalThis as typeof globalThis & { __signalKitX?: XActivityManager };

export const xActivityManager = globalForX.__signalKitX ?? new XActivityManager();
globalForX.__signalKitX = xActivityManager;
