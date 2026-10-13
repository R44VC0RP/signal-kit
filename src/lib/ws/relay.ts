import { EventEmitter } from "events";
import WebSocket from "ws";

/** Anything sent to clients: a SignalKitEvent, or a `signal_kit.*` control message. */
export type RelayPayload = { type: string } & Record<string, unknown>;

/** A client this far behind is disconnected rather than buffered without limit. */
const MAX_BUFFERED_BYTES = 4 * 1024 * 1024;

type RelayClient = {
  id: string;
  keyId: string;
  userId: string;
  ws: WebSocket;
  connectedAt: Date;
  /** While a `since` replay is being sent, live events queue here so order is preserved. */
  pending?: RelayPayload[] | null;
};

const MAX_PENDING = 5000;

class RelayHub {
  private clients = new Map<string, Map<string, RelayClient>>();

  /** Emits "online" (userId) when a user's first client connects. */
  readonly presence = new EventEmitter();

  /** Whether anything (an app, overlay or the dashboard) is listening for this user's events. */
  isOnline(userId: string) {
    return (this.clients.get(userId)?.size ?? 0) > 0;
  }

  add(client: RelayClient) {
    const userClients = this.clients.get(client.userId) ?? new Map<string, RelayClient>();
    const wasOnline = userClients.size > 0;
    userClients.set(client.id, client);
    this.clients.set(client.userId, userClients);
    if (!wasOnline) {
      this.presence.emit("online", client.userId);
    }

    client.ws.on("close", () => {
      userClients.delete(client.id);
      if (userClients.size === 0) {
        this.clients.delete(client.userId);
      }
    });
  }

  publish(userId: string, payload: RelayPayload) {
    const message = JSON.stringify(payload);
    const userClients = this.clients.get(userId);
    if (!userClients) {
      return 0;
    }

    let delivered = 0;
    for (const client of userClients.values()) {
      if (client.pending) {
        if (client.pending.length < MAX_PENDING) {
          client.pending.push(payload);
        }
        continue;
      }
      if (client.ws.readyState !== WebSocket.OPEN) {
        continue;
      }
      if (client.ws.bufferedAmount > MAX_BUFFERED_BYTES) {
        // It can reconnect with `since` and replay from the event log.
        client.ws.close(1013, "Client too slow; reconnect with since");
        continue;
      }
      client.ws.send(message);
      delivered += 1;
    }
    return delivered;
  }

  /** Ends a replay: sends queued live events the replay didn't already include, then goes live. */
  flush(userId: string, clientId: string, lastReplayedId: string | null) {
    const client = this.clients.get(userId)?.get(clientId);
    if (!client?.pending) {
      return;
    }
    const queued = client.pending;
    client.pending = null;
    for (const payload of queued) {
      const id = typeof payload.id === "string" ? payload.id : null;
      if (lastReplayedId && id && id <= lastReplayedId) {
        continue;
      }
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(payload));
      }
    }
  }

  /** Closes every socket opened with this API key, e.g. right after it is revoked. */
  disconnectKey(keyId: string, reason: string) {
    let closed = 0;
    for (const userClients of this.clients.values()) {
      for (const client of userClients.values()) {
        if (client.keyId === keyId) {
          client.ws.close(1008, reason);
          closed += 1;
        }
      }
    }
    return closed;
  }

  stats(userId: string) {
    return { clients: this.clients.get(userId)?.size ?? 0 };
  }
}

const globalForRelay = globalThis as typeof globalThis & { __signalKitRelay?: RelayHub };

export const relayHub = globalForRelay.__signalKitRelay ?? new RelayHub();
globalForRelay.__signalKitRelay = relayHub;
