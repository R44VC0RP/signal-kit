import WebSocket from "ws";

export type RelayPayload = {
  type: string;
  provider?: string;
  account?: unknown;
  subscription?: unknown;
  event?: unknown;
  receivedAt: string;
};

type RelayClient = {
  id: string;
  tokenId: string;
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
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
        delivered += 1;
      }
    }
    return delivered;
  }

  stats(userId: string) {
    return { clients: this.clients.get(userId)?.size ?? 0 };
  }
}

const globalForRelay = globalThis as typeof globalThis & { __signalKitRelay?: RelayHub };

export const relayHub = globalForRelay.__signalKitRelay ?? new RelayHub();
globalForRelay.__signalKitRelay = relayHub;
