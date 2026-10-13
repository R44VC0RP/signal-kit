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
  /** Set when this socket is a browser-source overlay (connected with its overlay URL token). */
  overlayId?: string;
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

  /** Sends to every socket of a user; `overlaysOnly` limits it to overlays (e.g. test alerts). */
  publish(userId: string, payload: RelayPayload, options: { overlaysOnly?: boolean } = {}) {
    const message = JSON.stringify(payload);
    const userClients = this.clients.get(userId);
    if (!userClients) {
      return 0;
    }

    let delivered = 0;
    for (const client of userClients.values()) {
      if (options.overlaysOnly && !client.overlayId) {
        continue;
      }
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

  /** Overlay sockets currently connected for one overlay (OBS etc. showing it). */
  overlayClients(overlayId: string) {
    const found: RelayClient[] = [];
    for (const userClients of this.clients.values()) {
      for (const client of userClients.values()) {
        if (client.overlayId === overlayId && client.ws.readyState === WebSocket.OPEN) {
          found.push(client);
        }
      }
    }
    return found;
  }

  /** Pushes a message to one overlay's sockets, e.g. new settings so OBS updates without a refresh. */
  sendToOverlay(overlayId: string, payload: RelayPayload) {
    const message = JSON.stringify(payload);
    const targets = this.overlayClients(overlayId);
    for (const client of targets) {
      client.ws.send(message);
    }
    return targets.length;
  }

  /** Disconnects an overlay's sockets, e.g. after its URL was reset or it was deleted. */
  disconnectOverlay(overlayId: string, reason: string) {
    for (const client of this.overlayClients(overlayId)) {
      client.ws.close(1008, reason);
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
