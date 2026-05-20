import { createServer } from "http";
import next from "next";
import { parse } from "url";
import { WebSocketServer } from "ws";
import { randomToken } from "@/lib/crypto";
import { eventSubManager } from "@/lib/twitch/eventsub-manager";
import { authenticateOverlayToken } from "@/lib/ws/auth";
import { relayHub } from "@/lib/ws/relay";
import { youtubeLiveManager } from "@/lib/youtube/live-manager";

const dev = process.env.NODE_ENV !== "production";
const bindHost = process.env.BIND_HOST ?? "0.0.0.0";
const port = Number(process.env.PORT ?? 3000);
const app = next({ dev, hostname: bindHost, port });
const handle = app.getRequestHandler();

async function main() {
  await app.prepare();

  const server = createServer((req, res) => {
    void handle(req, res, parse(req.url ?? "", true));
  });

  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const parsedUrl = parse(req.url ?? "", true);
    if (parsedUrl.pathname !== "/ws") {
      socket.destroy();
      return;
    }

    const token = Array.isArray(parsedUrl.query.token) ? parsedUrl.query.token[0] : parsedUrl.query.token;
    if (!token) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      void (async () => {
        const auth = await authenticateOverlayToken(token);
        if (!auth) {
          ws.close(1008, "Invalid token");
          return;
        }

        const clientId = randomToken(16);
        relayHub.add({
          id: clientId,
          tokenId: auth.tokenId,
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
    } else {
      console.warn("Signal Kit started without DATABASE_URL; EventSub manager is paused.");
    }
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
