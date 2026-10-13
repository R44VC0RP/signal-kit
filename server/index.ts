import { createServer } from "http";
import next from "next";
import { parse } from "url";
import { WebSocketServer } from "ws";
import { startConnectionHealthChecks } from "@/lib/connections/health";
import { randomToken } from "@/lib/crypto";
import { eventSubManager } from "@/lib/twitch/eventsub-manager";
import { getAppUrl } from "@/lib/app-url";
import { authenticateApiKey, authenticateSession } from "@/lib/ws/auth";
import { relayHub } from "@/lib/ws/relay";
import { youtubeLiveManager } from "@/lib/youtube/live-manager";

const dev = process.env.NODE_ENV !== "production";
const bindHost = process.env.BIND_HOST ?? "0.0.0.0";
const port = Number(process.env.PORT ?? 3000);
const app = next({ dev, hostname: bindHost, port });
const handle = app.getRequestHandler();

async function main() {
  await app.prepare();
  // Next's own upgrades (dev hot reload) must reach Next instead of being dropped.
  const handleUpgrade = app.getUpgradeHandler();

  const server = createServer((req, res) => {
    void handle(req, res, parse(req.url ?? "", true));
  });

  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const parsedUrl = parse(req.url ?? "", true);
    if (parsedUrl.pathname !== "/ws") {
      if (parsedUrl.pathname?.startsWith("/_next/")) {
        void handleUpgrade(req, socket, head);
      } else {
        socket.destroy();
      }
      return;
    }

    const token = Array.isArray(parsedUrl.query.token) ? parsedUrl.query.token[0] : parsedUrl.query.token;
    // Without a key, only the dashboard (same origin, signed-in session) may connect.
    // The Origin check stops other sites from riding the session cookie.
    if (!token && req.headers.origin !== getAppUrl()) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      void (async () => {
        const auth = token ? await authenticateApiKey(token) : await authenticateSession(req.headers.cookie);
        if (!auth) {
          ws.close(1008, token ? "Invalid API key" : "Not signed in");
          return;
        }

        const clientId = randomToken(16);
        relayHub.add({
          id: clientId,
          keyId: auth.keyId,
          userId: auth.userId,
          ws,
          connectedAt: new Date(),
        });

        ws.send(
          JSON.stringify({
            type: "signal_kit.ready",
            receivedAt: new Date().toISOString(),
            event: { clientId, label: auth.label },
          }),
        );
      })().catch((error) => {
        console.error("[relay] upgrade auth failed", error);
        ws.close(1011, "Relay auth failed");
      });
    });
  });

  server.listen(port, bindHost, () => {
    console.log(`Signal Kit ready on http://${bindHost}:${port}`);
    if (process.env.DATABASE_URL) {
      eventSubManager.start();
      youtubeLiveManager.start();
      startConnectionHealthChecks();
    } else {
      console.warn("Signal Kit started without DATABASE_URL; EventSub manager is paused.");
    }
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
