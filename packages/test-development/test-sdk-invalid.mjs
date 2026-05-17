/**
 * Verifies the SDK does not reconnect forever when the relay closes with
 * 1008 (invalid/revoked token).
 */

import { SignalKit } from "@signal-kit/client";

const URL = process.env.SIGNAL_KIT_URL ?? "wss://signal.ryan.ceo/ws";
let openCount = 0;
let closeCount = 0;

const events = new SignalKit({
  url: URL,
  token: "sk_live_not_a_real_token_value",
  reconnectMs: 500,
  onOpen: () => {
    openCount += 1;
    console.log("[sdk-invalid] open", openCount);
  },
  onClose: ({ code, reason }) => {
    closeCount += 1;
    console.log("[sdk-invalid] close", { closeCount, code, reason });
  },
});

events.connect();

setTimeout(() => {
  console.log("[sdk-invalid] summary", { openCount, closeCount });
  if (openCount !== 1 || closeCount !== 1) {
    console.error("[sdk-invalid] expected one open and one close, with no reconnect loop");
    process.exit(1);
  }
  events.close();
  process.exit(0);
}, 3_000);
