import type { IncomingMessage } from "http";
import type { Duplex } from "stream";
import WebSocket, { WebSocketServer } from "ws";
import { getAppUrl } from "@/lib/app-url";
import { randomToken } from "@/lib/crypto";
import { isEventId } from "@/lib/events/ids";
import { eventsSince, MAX_REPLAY } from "@/lib/events/ingest";
import { authenticateApiKey, authenticateSession } from "./auth";
import { relayHub } from "./relay";

/**
 * The relay socket at /ws.
 *
 * Auth, in order: `?token=` (legacy), the dashboard's session cookie (same origin only, so other
 * sites can't ride it), or a first message `{ "type": "auth", "token": "sk_live_…", "since": "…" }`
 * within 5 seconds. Keys sent in the first message stay out of URLs and proxy logs.
 * `since` replays stored events after that id before going live.
 */

const AUTH_TIMEOUT_MS = 5000;
const MAX_UNAUTHENTICATED_PER_IP = 20;
const HEARTBEAT_MS = 30_000;

const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
const unauthenticated = new Map<string, number>();
const alive = new WeakSet<WebSocket>();

let heartbeat: NodeJS.Timeout | undefined;

/** Pings every client; anything that didn't answer the previous ping is dropped. */
export function startRelayHeartbeat() {
  heartbeat ??= setInterval(() => {
    for (const ws of wss.clients) {
      if (!alive.has(ws)) {
        ws.terminate();
        continue;
      }
      alive.delete(ws);
      ws.ping();
    }
  }, HEARTBEAT_MS);
}

type Auth = { userId: string; keyId: string; label: string } | null;

export function handleRelayUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer) {
  const url = new URL(req.url ?? "/", "http://relay.local");
  const token = url.searchParams.get("token");
  const since = url.searchParams.get("since");
  const ip = clientIp(req);

  wss.handleUpgrade(req, socket, head, (ws) => {
    alive.add(ws);
    ws.on("pong", () => alive.add(ws));

    void (async () => {
      if (token) {
        await start(ws, await authenticateApiKey(token), since, "Invalid API key");
        return;
      }
      if (req.headers.origin === getAppUrl() && req.headers.cookie) {
        const session = await authenticateSession(req.headers.cookie);
        if (session) {
          await start(ws, session, since, "Not signed in");
          return;
        }
      }
      waitForAuthMessage(ws, ip);
    })().catch((error) => {
      console.error("[relay] auth failed", error);
      ws.close(1011, "Relay auth failed");
    });
  });
}

function waitForAuthMessage(ws: WebSocket, ip: string) {
  const pending = unauthenticated.get(ip) ?? 0;
  if (pending >= MAX_UNAUTHENTICATED_PER_IP) {
    ws.close(1008, "Too many unauthenticated connections");
    return;
  }
  unauthenticated.set(ip, pending + 1);
  let settled = false;
  const settle = () => {
    if (!settled) {
      settled = true;
      clearTimeout(timer);
      const left = (unauthenticated.get(ip) ?? 1) - 1;
      if (left > 0) {
        unauthenticated.set(ip, left);
      } else {
        unauthenticated.delete(ip);
      }
    }
  };
  const timer = setTimeout(() => {
    settle();
    ws.close(1008, "Send an auth message first");
  }, AUTH_TIMEOUT_MS);
  ws.once("close", settle);
  ws.once("message", (data) => {
    settle();
    let message: { type?: string; token?: unknown; since?: unknown };
    try {
      message = JSON.parse(data.toString());
    } catch {
      ws.close(1008, "Send an auth message first");
      return;
    }
    if (message.type !== "auth" || typeof message.token !== "string") {
      ws.close(1008, "Send an auth message first");
      return;
    }
    const since = typeof message.since === "string" ? message.since : null;
    void authenticateApiKey(message.token)
      .then((auth) => start(ws, auth, since, "Invalid API key"))
      .catch((error) => {
        console.error("[relay] auth failed", error);
        ws.close(1011, "Relay auth failed");
      });
  });
}

async function start(ws: WebSocket, auth: Auth, since: string | null, failure: string) {
  if (!auth) {
    ws.close(1008, failure);
    return;
  }
  if (ws.readyState !== WebSocket.OPEN) {
    return;
  }
  const replay = isEventId(since);
  const clientId = randomToken(16);
  relayHub.add({ id: clientId, keyId: auth.keyId, userId: auth.userId, ws, connectedAt: new Date(), pending: replay ? [] : null });
  ws.send(
    JSON.stringify({
      type: "signal_kit.ready",
      v: 2,
      clientId,
      label: auth.label,
      replaying: replay,
      receivedAt: new Date().toISOString(),
      event: { clientId, label: auth.label },
    }),
  );
  if (!replay) {
    return;
  }

  let lastId: string | null = null;
  let count = 0;
  let truncated = false;
  try {
    const missed = await eventsSince(auth.userId, since!, MAX_REPLAY + 1);
    truncated = missed.length > MAX_REPLAY;
    for (const event of missed.slice(0, MAX_REPLAY)) {
      if (ws.readyState !== WebSocket.OPEN) {
        break;
      }
      ws.send(JSON.stringify(event));
      lastId = event.id;
      count += 1;
    }
  } catch (error) {
    console.error("[relay] replay failed", error);
  }
  if (ws.readyState === WebSocket.OPEN) {
    // `truncated` means more than MAX_REPLAY were missed; the client should treat the gap as lost.
    ws.send(JSON.stringify({ type: "signal_kit.replayed", count, truncated, lastId, receivedAt: new Date().toISOString() }));
  }
  relayHub.flush(auth.userId, clientId, lastId);
}

function clientIp(req: IncomingMessage) {
  const forwarded = req.headers["x-forwarded-for"];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim();
  return first || req.socket.remoteAddress || "unknown";
}
