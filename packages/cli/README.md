# @signal-kit/cli

Stream Signal Kit Twitch EventSub relay messages in a terminal.

## Install

```bash
npm install -g @signal-kit/cli
```

## Configure

The CLI automatically loads `.env` from the current working directory.

```env
SIGNALKIT_TOKEN=sk_live_...
# Optional, defaults to wss://signal.ryan.ceo/ws
SIGNALKIT_URL=wss://signal.ryan.ceo/ws
```

It also accepts the older underscore names:

```env
SIGNAL_KIT_TOKEN=sk_live_...
SIGNAL_KIT_URL=wss://signal.ryan.ceo/ws
```

For local testing, `WEBSOCKET_TOKEN` is accepted too.

## Use

```bash
signal-kit
```

Useful flags:

```bash
signal-kit --token sk_live_...
signal-kit --url wss://signal.ryan.ceo/ws
signal-kit --json
signal-kit --raw
signal-kit --types channel.chat.message,channel.cheer
signal-kit --duration 30s
signal-kit --no-color
```

The default output is a compact human-readable stream. Use `--json` for one JSON object per line or `--raw` for the full relay payload.
