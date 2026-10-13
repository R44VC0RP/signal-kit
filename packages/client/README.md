# @signal-kit/client

WebSocket client for [Signal Kit](https://signal.ryan.ceo): Twitch, YouTube and X live events in one normalized, typed stream, with replay after reconnects. Works in browsers, Bun, Deno and Node 22+.

## Install

```bash
npm install @signal-kit/client
```

## Use it

Create an API key in the [dashboard](https://signal.ryan.ceo/dashboard/keys), then:

```ts
import { SignalKit } from "@signal-kit/client";

const kit = new SignalKit({ token: process.env.SIGNAL_KIT_KEY! });

kit.on("tip", (e) => console.log(`${e.actor?.name} sent ${e.amount?.display}`));
kit.on("chat.message", (e) => console.log(e.actor?.name, e.message));

kit.connect();
```

A Twitch cheer, a YouTube Super Chat and a Super Sticker are all `kind: "tip"` with an `amount`, so one handler covers every platform.

## Events

```ts
{
  v: 2,
  id: "01M4V160WEEDSY6AG1YG3PZRPQ",      // sortable; pass to `since` to resume
  kind: "tip",                            // chat.message, follow, subscription, raid, redemption, …
  platform: "twitch",                     // "twitch" | "youtube" | "x"
  channel: { connectionId, id, name },    // which of your channels it came from
  actor: { id, name, login, badges },     // who did it, when there is someone
  message: "the websocket is SO clean",
  amount: { value: 500, currency: "BITS", display: "500 bits" },
  data: { /* kind-specific fields */ },
  occurredAt: "2026-10-13T16:22:58.225Z",
  raw: { type: "channel.cheer", event: { /* the platform's original payload */ } }
}
```

The full types are exported: `import type { SignalKitEvent, EventKind } from "@signal-kit/client"`.

## Reconnects and replay

Events are kept for 24 hours. The client remembers the last event id and, after a reconnect, asks for everything it missed; events are never delivered twice. To resume across restarts, save `kit.lastEventId` and pass it back:

```ts
const kit = new SignalKit({ token, since: savedLastEventId });
```

## API

### `new SignalKit(options)`

- `token` (required): API key from the dashboard. It is sent in the first message, never in the URL.
- `url`: relay URL. Default `wss://signal.ryan.ceo/ws`.
- `since`: resume after this event id.
- `WebSocket`: WebSocket constructor. Defaults to `globalThis.WebSocket`; on older Node pass the `ws` package.
- `reconnect`: `{ minMs, maxMs }` exponential backoff (default 1s to 30s), or `false`.
- `terminalCloseCodes`: close codes that should not reconnect. Default `1002`, `1003`, `1007`, `1008` (e.g. a revoked key).
- `onOpen`, `onReady`, `onReplayed`, `onClose`, `onError`: lifecycle callbacks. `onReplayed` reports `{ count, truncated }`; `truncated` means more was missed than is kept.

### Methods

- `connect()`: open the connection.
- `close()`: disconnect and stop reconnecting.
- `on(kind, handler)`: a normalized kind (`"tip"`), a raw platform type (`"channel.cheer"`), or `"*"`. Returns an unsubscribe function.
- `once(kind, handler)`, `off(kind, handler)`.
- `lastEventId`: id of the newest event received.

## Browser via `<script>` tag

```html
<script src="https://signal.ryan.ceo/twe-client.js"></script>
<script>
  const kit = new SignalKit({ token: "sk_live_..." });
  kit.on("chat.message", (e) => console.log(e.actor?.name, e.message));
  kit.connect();
</script>
```

Anyone who can see the page can see the key, so only do this for overlays you run yourself.

## Upgrading from 0.x

- `on("channel.cheer", ({ event }) => …)` still fires, but handlers now receive the normalized event; the original payload is at `e.raw.event` (and `e.event`).
- `url` is optional and `reconnectMs` is replaced by `reconnect`.

## License

MIT.
