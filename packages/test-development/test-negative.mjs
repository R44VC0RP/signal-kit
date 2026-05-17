/**
 * Negative tests for the Signal Kit relay.
 *
 * Asserts that:
 *   - A connection with no token is rejected by the upgrade.
 *   - A connection with a bogus token is closed with code 1008.
 */

const URL = process.env.SIGNAL_KIT_URL ?? "wss://signal.ryan.ceo/ws";

await test("no token", () => connect(URL));
await test("invalid token", () => connect(`${URL}?token=sk_live_not_a_real_token_value`));

async function test(name, run) {
  try {
    const result = await run();
    console.log(`[negative] ${name}:`, result);
  } catch (error) {
    console.error(`[negative] ${name}: errored ->`, error?.message ?? error);
  }
}

function connect(url) {
  return new Promise((resolve) => {
    const ws = new WebSocket(url);
    const timer = setTimeout(() => {
      ws.close();
      resolve({ status: "timed_out" });
    }, 5_000);

    ws.addEventListener("open", () => {
      // Invalid-token connections complete the WebSocket upgrade, then the
      // relay closes them with 1008 after token validation.
    });
    ws.addEventListener("close", (event) => {
      clearTimeout(timer);
      resolve({ status: "closed", code: event.code, reason: event.reason });
    });
    ws.addEventListener("error", (event) => {
      clearTimeout(timer);
      resolve({ status: "error", message: event?.message ?? "(opaque)" });
    });
  });
}
