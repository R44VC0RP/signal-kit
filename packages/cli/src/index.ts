import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { SignalKit, type SignalKitMessage } from "@signal-kit/client";
import { WebSocket } from "ws";

type Options = {
  token?: string;
  url: string;
  json: boolean;
  raw: boolean;
  color: boolean;
  types: Set<string> | null;
  durationMs: number | null;
};

const DEFAULT_URL = "wss://signal.ryan.ceo/ws";
const TERMINAL_CLOSE_CODES = new Set([1002, 1003, 1007, 1008]);

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

async function main() {
  loadDotenv(resolve(process.cwd(), ".env"));

  const options = parseArgs(process.argv.slice(2));
  if (!options.token) {
    printHelp("Missing relay token. Set SIGNALKIT_TOKEN in .env or pass --token sk_live_...");
    process.exit(1);
  }

  if (!options.json && !options.raw) {
    console.log(
      `${dim(options, "Signal Kit stream")} ${accent(options, options.url)} ${dim(options, "token=")}${redact(options.token)}`,
    );
    console.log(dim(options, "Press Ctrl+C to disconnect.\n"));
  }

  let closingIntentionally = false;

  const client = new SignalKit({
    url: options.url,
    token: options.token,
    WebSocket: WebSocket as unknown as typeof globalThis.WebSocket,
    reconnectMs: 2_000,
    onOpen: () => {
      if (!options.json && !options.raw) {
        console.log(`${ok(options, "connected")} ${dim(options, new Date().toISOString())}`);
      }
    },
    onClose: ({ code, reason }) => {
      if (!closingIntentionally && !options.json && !options.raw) {
        const text = reason ? `${code} ${reason}` : String(code);
        console.log(`${warn(options, "closed")} ${dim(options, text)}`);
      }
      if (!closingIntentionally && TERMINAL_CLOSE_CODES.has(code)) {
        process.exitCode = 1;
        setTimeout(() => process.exit(1), 25);
      }
    },
    onError: (error) => {
      if (!options.json && !options.raw) {
        console.error(`${bad(options, "error")} ${String(error)}`);
      }
    },
  });

  client.on("*", (message) => {
    if (options.types && !options.types.has(message.type)) {
      return;
    }

    if (options.raw) {
      console.log(JSON.stringify(message, null, 2));
      return;
    }

    if (options.json) {
      console.log(JSON.stringify(message));
      return;
    }

    console.log(formatMessage(options, message));
  });

  process.on("SIGINT", () => {
    closingIntentionally = true;
    if (!options.json && !options.raw) {
      console.log(`\n${dim(options, "disconnecting...")}`);
    }
    client.close();
    process.exit(0);
  });

  client.connect();

  if (options.durationMs !== null) {
    setTimeout(() => {
      closingIntentionally = true;
      if (!options.json && !options.raw) {
        console.log(`\n${dim(options, `duration elapsed (${options.durationMs}ms), disconnecting...`)}`);
      }
      client.close();
      setTimeout(() => process.exit(0), 25);
    }, options.durationMs);
  }
}

function parseArgs(args: string[]): Options {
  const options: Options = {
    token: process.env.SIGNALKIT_TOKEN ?? process.env.SIGNAL_KIT_TOKEN ?? process.env.WEBSOCKET_TOKEN,
    url: process.env.SIGNALKIT_URL ?? process.env.SIGNAL_KIT_URL ?? DEFAULT_URL,
    json: false,
    raw: false,
    color: !process.env.NO_COLOR,
    types: null,
    durationMs: null,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
      case "--token":
      case "-t":
        options.token = readValue(args, ++index, arg);
        break;
      case "--url":
      case "-u":
        options.url = readValue(args, ++index, arg);
        break;
      case "--json":
        options.json = true;
        break;
      case "--raw":
        options.raw = true;
        break;
      case "--no-color":
        options.color = false;
        break;
      case "--types":
        options.types = new Set(readValue(args, ++index, arg).split(",").map((type) => type.trim()).filter(Boolean));
        break;
      case "--duration":
        options.durationMs = parseDuration(readValue(args, ++index, arg));
        break;
      default:
        if (arg.startsWith("--token=")) {
          options.token = arg.slice("--token=".length);
        } else if (arg.startsWith("--url=")) {
          options.url = arg.slice("--url=".length);
        } else if (arg.startsWith("--types=")) {
          options.types = new Set(arg.slice("--types=".length).split(",").map((type) => type.trim()).filter(Boolean));
        } else if (arg.startsWith("--duration=")) {
          options.durationMs = parseDuration(arg.slice("--duration=".length));
        } else {
          printHelp(`Unknown option: ${arg}`);
          process.exit(1);
        }
    }
  }

  return options;
}

function parseDuration(value: string) {
  const match = /^(\d+)(ms|s|m)?$/.exec(value.trim());
  if (!match) {
    printHelp(`Invalid duration: ${value}. Use milliseconds, 8s, or 2m.`);
    process.exit(1);
  }

  const amount = Number(match[1]);
  const unit = match[2] ?? "ms";
  if (unit === "m") {
    return amount * 60_000;
  }
  if (unit === "s") {
    return amount * 1_000;
  }
  return amount;
}

function readValue(args: string[], index: number, flag: string) {
  const value = args[index];
  if (!value || value.startsWith("-")) {
    printHelp(`Missing value for ${flag}`);
    process.exit(1);
  }
  return value;
}

function loadDotenv(path: string) {
  if (!existsSync(path)) {
    return;
  }

  const content = readFileSync(path, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separator = trimmed.indexOf("=");
    if (separator === -1) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    if (process.env[key] !== undefined) {
      continue;
    }

    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function formatMessage(options: Options, message: SignalKitMessage) {
  const time = new Date(message.receivedAt).toLocaleTimeString();
  const left = `${dim(options, time)} ${accent(options, message.type)}`;
  const event = message.event;

  if (message.type === "signal_kit.ready" && isObject(event)) {
    return `${left} ${ok(options, "ready")} client=${stringField(event, "clientId") ?? "?"} label=${stringField(event, "label") ?? "?"}`;
  }

  if (!isObject(event)) {
    return left;
  }

  const provider = "provider" in message && typeof message.provider === "string" ? message.provider : undefined;
  if (provider === "youtube" || message.type.startsWith("youtube.")) {
    return formatYouTubeMessage(options, left, event);
  }

  const user = stringField(event, "user_name") ?? stringField(event, "user_login") ?? stringField(event, "chatter_user_name");
  const channel = stringField(event, "broadcaster_user_name") ?? stringField(event, "broadcaster_user_login");
  const pieces = [
    user ? `user=${strong(options, user)}` : null,
    channel ? `channel=${channel}` : null,
    numericField(event, "bits") != null ? `bits=${numericField(event, "bits")}` : null,
    stringField(event, "tier") ? `tier=${stringField(event, "tier")}` : null,
    stringField(event, "title") ? `title=${quote(stringField(event, "title")!)}` : null,
    event.message && isObject(event.message) && stringField(event.message, "text") ? `msg=${quote(stringField(event.message, "text")!)}` : null,
    stringField(event, "from_broadcaster_user_name") ? `from=${stringField(event, "from_broadcaster_user_name")}` : null,
    stringField(event, "reward_title") ? `reward=${quote(stringField(event, "reward_title")!)}` : null,
  ].filter(Boolean);

  return pieces.length > 0 ? `${left} ${pieces.join(" ")}` : left;
}

function formatYouTubeMessage(options: Options, left: string, event: Record<string, unknown>) {
  const snippet = objectField(event, "snippet");
  const author = objectField(event, "authorDetails");
  const pieces = [
    author ? `user=${strong(options, stringField(author, "displayName") ?? "?")}` : null,
    snippet && stringField(snippet, "displayMessage") ? `msg=${quote(stringField(snippet, "displayMessage")!)}` : null,
    snippet && stringField(snippet, "type") ? `kind=${stringField(snippet, "type")}` : null,
  ].filter(Boolean);

  return pieces.length > 0 ? `${left} ${pieces.join(" ")}` : left;
}

function printHelp(error?: string) {
  if (error) {
    console.error(error);
    console.error("");
  }
  console.log(`Usage: signal-kit [options]

Streams Signal Kit relay events to stdout.

Environment:
  SIGNALKIT_TOKEN       Relay token. Also accepts SIGNAL_KIT_TOKEN and WEBSOCKET_TOKEN.
  SIGNALKIT_URL         Relay URL. Defaults to ${DEFAULT_URL}. Also accepts SIGNAL_KIT_URL.

Options:
  -t, --token <token>   Relay token. Overrides env.
  -u, --url <url>       Relay URL. Overrides env.
      --types <list>    Comma-separated event type filter.
      --json            Print one JSON object per line.
      --raw             Print full pretty JSON payloads.
      --no-color        Disable ANSI colors.
      --duration <time> Disconnect after a duration. Supports ms, s, m. Example: 8s.
  -h, --help            Show help.

Examples:
  signal-kit
  signal-kit --types channel.chat.message,youtube.live_chat.message
  signal-kit --json | jq .
  signal-kit --duration 30s
`);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringField(value: Record<string, unknown>, key: string) {
  const field = value[key];
  return typeof field === "string" ? field : null;
}

function numericField(value: Record<string, unknown>, key: string) {
  const field = value[key];
  return typeof field === "number" ? field : null;
}

function objectField(value: Record<string, unknown>, key: string) {
  const field = value[key];
  return isObject(field) ? field : null;
}

function quote(value: string) {
  const compact = value.replace(/\s+/g, " ").trim();
  return JSON.stringify(compact.length > 80 ? `${compact.slice(0, 77)}...` : compact);
}

function redact(token: string) {
  return token.length > 16 ? `${token.slice(0, 8)}...${token.slice(-4)}` : "<redacted>";
}

function color(options: Options, code: string, text: string) {
  return options.color ? `\u001b[${code}m${text}\u001b[0m` : text;
}

function dim(options: Options, text: string) {
  return color(options, "2", text);
}

function accent(options: Options, text: string) {
  return color(options, "35", text);
}

function strong(options: Options, text: string) {
  return color(options, "1", text);
}

function ok(options: Options, text: string) {
  return color(options, "32", text);
}

function warn(options: Options, text: string) {
  return color(options, "33", text);
}

function bad(options: Options, text: string) {
  return color(options, "31", text);
}
