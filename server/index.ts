import { createServer } from "http";
import next from "next";
import { startConnectionHealthChecks } from "@/lib/connections/health";
import { startEventRetention } from "@/lib/events/ingest";
import { eventSubManager } from "@/lib/twitch/eventsub-manager";
import { handleRelayUpgrade, startRelayHeartbeat } from "@/lib/ws/server";
import { youtubeLiveManager } from "@/lib/youtube/live-manager";

const dev = process.env.NODE_ENV !== "production";
const bindHost = process.env.BIND_HOST ?? "0.0.0.0";
const port = Number(process.env.PORT ?? 3000);
const app = next({ dev, hostname: bindHost, port });
const handle = app.getRequestHandler();

async function main() {
  await app.prepare();
  const handleUpgrade = app.getUpgradeHandler();

  const server = createServer((req, res) => {
    void handle(req, res);
  });

  server.on("upgrade", (req, socket, head) => {
    const pathname = new URL(req.url ?? "/", "http://local").pathname;
    if (pathname === "/ws") {
      handleRelayUpgrade(req, socket, head);
    } else if (pathname.startsWith("/_next/")) {
      // Next's own upgrades (dev hot reload) must reach Next instead of being dropped.
      void handleUpgrade(req, socket, head);
    } else {
      socket.destroy();
    }
  });

  server.listen(port, bindHost, () => {
    console.log(`Signal Kit ready on http://${bindHost}:${port}`);
    if (process.env.DATABASE_URL) {
      eventSubManager.start();
      youtubeLiveManager.start();
      startConnectionHealthChecks();
      startEventRetention();
      startRelayHeartbeat();
    } else {
      console.warn("Signal Kit started without DATABASE_URL; EventSub manager is paused.");
    }
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
