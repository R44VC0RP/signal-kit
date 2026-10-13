# @signal-kit/cli

Stream your [Signal Kit](https://signal.ryan.ceo) events (Twitch, YouTube, X) in a terminal.

## Install

```bash
npm install -g @signal-kit/cli
```

## Configure

Create an API key in the [dashboard](https://signal.ryan.ceo/dashboard/keys). The CLI loads `.env` from the current directory.

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
signal-kit --types tip,chat.message      # normalized kinds or raw types like channel.cheer
signal-kit --duration 30s
signal-kit --no-color
```

The default output is one line per event (platform, kind, who, amount, message). Use `--json` for one JSON event per line or `--raw` for pretty-printed events.
