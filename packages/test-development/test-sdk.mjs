/**
 * Node test for @signal-kit/client SDK.
 *
 * Connects to the live Signal Kit relay using WEBSOCKET_TOKEN from .env,
 * subscribes to several event types plus the "*" wildcard, prints each
 * received event, and exits after 20 seconds.
 *
 * Run from packages/test-development:
 *   npm run test:sdk
 */

import { SignalKit } from "@signal-kit/client";

const TOKEN = process.env.WEBSOCKET_TOKEN;
const URL = process.env.SIGNAL_KIT_URL ?? "wss://signal.ryan.ceo/ws";
const DURATION_MS = Number(process.env.DURATION_MS ?? 20_000);

if (!TOKEN) {
  console.error("Missing WEBSOCKET_TOKEN. Did you create packages/test-development/.env?");
  process.exit(1);
}

console.log("[sdk-test] connecting", { url: URL, token: redact(TOKEN), durationMs: DURATION_MS });

const events = new SignalKit({
  url: URL,
  token: TOKEN,
  reconnectMs: 1_000,
  onOpen: () => console.log("[sdk-test] socket open"),
  onClose: ({ code, reason }) => console.log("[sdk-test] socket close", { code, reason }),
  onError: (error) => console.error("[sdk-test] socket error", error?.message ?? error),
});

let messageCount = 0;
const counts = new Map();

events.on("*", (message) => {
  messageCount += 1;
  counts.set(message.type, (counts.get(message.type) ?? 0) + 1);
  const summary = summarize(message);
  console.log(
    `[event #${String(messageCount).padStart(3, " ")}] ${message.type} · ${message.receivedAt}`,
  );
  if (summary) {
    console.log(`            ${summary}`);
  }
});

events.connect();

setTimeout(() => {
  console.log("\n[sdk-test] summary");
  console.log("  total messages:", messageCount);
  if (counts.size > 0) {
    console.log("  by type:");
    for (const [type, count] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${count.toString().padStart(4, " ")}  ${type}`);
    }
  } else {
    console.log("  no events received in window");
  }
  events.close();
  process.exit(0);
}, DURATION_MS);

function redact(token) {
  if (typeof token !== "string" || token.length < 10) return "<redacted>";
  return token.slice(0, 8) + "..." + token.slice(-4);
}

function summarize(message) {
  if (message.type === "signal_kit.ready") {
    return `clientId=${message.event?.clientId} label=${message.event?.label}`;
  }
  if (!message.event || typeof message.event !== "object") return "";
  const event = message.event;
  const fields = [];
  if (event.user_name) fields.push(`user=${event.user_name}`);
  if (event.broadcaster_user_name) fields.push(`channel=${event.broadcaster_user_name}`);
  if (event.bits != null) fields.push(`bits=${event.bits}`);
  if (event.tier) fields.push(`tier=${event.tier}`);
  if (event.message?.text) fields.push(`message=${JSON.stringify(event.message.text).slice(0, 60)}`);
  if (event.title) fields.push(`title=${JSON.stringify(event.title).slice(0, 50)}`);
  if (event.from_broadcaster_user_name) fields.push(`from=${event.from_broadcaster_user_name}`);
  return fields.join(" ");
}
