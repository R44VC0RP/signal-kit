# @signal-kit/client

Tiny WebSocket client for [Signal Kit](https://signal.ryan.ceo). Subscribe to Twitch EventSub notifications using a relay token.

## Install

```bash
npm install @signal-kit/client
```

## Use it

```ts
import { SignalKit } from "@signal-kit/client";

const events = new SignalKit({
  url: "wss://signal.ryan.ceo/ws",
  token: process.env.SIGNAL_KIT_TOKEN!,
});

events.on("channel.cheer", ({ event }) => {
  console.log(`${event.user_name} cheered ${event.bits} bits`);
});

events.connect();
```

## API

### `new SignalKit(options)`

Options:

- `url` (required) — Relay WebSocket URL.
- `token` (required) — Relay token issued by the Signal Kit dashboard.
- `WebSocket` — Optional WebSocket constructor. Defaults to `globalThis.WebSocket`. On older Node versions, pass the `ws` package: `import { WebSocket } from "ws"; new SignalKit({ ..., WebSocket })`.
- `reconnectMs` — Auto-reconnect delay in ms. Default `2000`. Pass `false` to disable.
- `onOpen`, `onClose`, `onError` — Lifecycle callbacks.

### Methods

- `connect()` — Open the connection. Auto-reconnects on close unless `close()` is called or `reconnectMs: false`.
- `close()` — Disconnect and stop auto-reconnect.
- `on(type, handler)` — Subscribe to a specific event type. Use `"*"` to receive everything. Returns an unsubscribe function.
- `once(type, handler)` — Subscribe once.
- `off(type, handler)` — Unsubscribe a specific handler.

### Message shape

```ts
{
  type: "channel.cheer",
  subscription: { id: "...", type: "channel.cheer", version: "1" },
  event: { user_name: "viewer", bits: 100, /* ... */ },
  receivedAt: "2026-05-15T00:00:00.000Z"
}
```

The `event` field is the raw Twitch EventSub payload. Signal Kit does not reshape it.

## Browser via `<script>` tag

Signal Kit also serves a global IIFE build at `/twe-client.js` on every Signal Kit instance:

```html
<script src="https://signal.ryan.ceo/twe-client.js"></script>
<script>
  const events = new SignalKitClient({
    url: "wss://signal.ryan.ceo/ws",
    token: "sk_live_...",
  });
  events.on("channel.cheer", ({ event }) => console.log(event));
  events.connect();
</script>
```

## License

MIT.
