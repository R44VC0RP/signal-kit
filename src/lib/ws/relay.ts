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
};

class RelayHub {
  private clients = new Map<string, Map<string, RelayClient>>();

  add(client: RelayClient) {
    const userClients = this.clients.get(client.userId) ?? new Map<string, RelayClient>();
    userClients.set(client.id, client);
    this.clients.set(client.userId, userClients);

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
