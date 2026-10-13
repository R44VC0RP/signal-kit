/**
 * @signal-kit/client
 *
 * WebSocket client for Signal Kit. One connection delivers Twitch, YouTube and X events in a
 * single normalized format. Works in browsers, Bun, Deno and Node 22+.
 *
 *   const kit = new SignalKit({ token: "sk_live_…" });
 *   kit.on("tip", (event) => alert(`${event.actor?.name} sent ${event.amount?.display}`));
 *   kit.connect();
 */

import type { EventKind, SignalKitEvent } from "./types";

export type * from "./types";

/** Messages the server sends about the connection itself. */
export type SignalKitControl =
  | { type: "signal_kit.ready"; v: 2; clientId: string; label: string; replaying: boolean; receivedAt: string }
  | { type: "signal_kit.replayed"; count: number; truncated: boolean; lastId: string | null; receivedAt: string };

export type SignalKitOptions = {
  /** API key from the Signal Kit dashboard. */
  token: string;
  /** Relay WebSocket URL. Default `wss://signal.ryan.ceo/ws`. */
  url?: string;
  /**
   * Resume after this event id. Missed events (kept for 24 hours) are replayed before live ones.
   * The client tracks the last id itself across reconnects; pass this to resume across restarts.
   */
  since?: string;
  /** WebSocket constructor. Defaults to `globalThis.WebSocket`; pass `ws` for older Node. */
  WebSocket?: typeof WebSocket;
  /** Reconnect with exponential backoff. Default `{ minMs: 1000, maxMs: 30000 }`; `false` disables it. */
  reconnect?: { minMs?: number; maxMs?: number } | false;
  /** @deprecated Fixed reconnect delay; use `reconnect`. */
  reconnectMs?: number | false;
  /** Close codes that should not reconnect. Default: 1002, 1003, 1007, 1008 (e.g. invalid key). */
  terminalCloseCodes?: number[];
  onOpen?: () => void;
  onReady?: (info: Extract<SignalKitControl, { type: "signal_kit.ready" }>) => void;
  /** Called after a `since` replay. `truncated` means more events were missed than are kept. */
  onReplayed?: (info: Extract<SignalKitControl, { type: "signal_kit.replayed" }>) => void;
  onClose?: (event: { code: number; reason: string }) => void;
  onError?: (error: unknown) => void;
};

type EventOf<K extends EventKind> = SignalKitEvent & { kind: K };
type Handler<E> = (event: E) => void | Promise<void>;

const DEFAULT_URL = "wss://signal.ryan.ceo/ws";
const SEEN_LIMIT = 1000;

export class SignalKit {
  private socket?: WebSocket;
  private handlers = new Map<string, Set<Handler<SignalKitEvent>>>();
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private attempt = 0;
  private closed = false;
  private lastId?: string;
  private seen = new Set<string>();

  constructor(private readonly options: SignalKitOptions) {
    if (!options.token) {
      throw new Error("SignalKit: `token` is required.");
    }
    this.lastId = options.since;
  }

  /** Id of the newest event received, for resuming later with `since`. */
  get lastEventId(): string | undefined {
    return this.lastId;
  }

  /** Open the connection. No-op if already open or connecting. */
  connect(): this {
    if (this.socket && (this.socket.readyState === 0 || this.socket.readyState === 1)) {
      return this;
    }
    clearTimeout(this.reconnectTimer);
    this.closed = false;
    const WebSocketImpl = this.options.WebSocket ?? globalThis.WebSocket;
    if (!WebSocketImpl) {
      throw new Error("SignalKit: no WebSocket constructor found. Pass `WebSocket` in options.");
    }

    // The key goes in the first message, not the URL, so it never lands in proxy or access logs.
    const socket = new WebSocketImpl(this.options.url ?? DEFAULT_URL);
    this.socket = socket;

    socket.addEventListener("open", () => {
      socket.send(JSON.stringify({ type: "auth", token: this.options.token, since: this.lastId }));
      this.options.onOpen?.();
    });
    socket.addEventListener("message", (event) => {
      const data = (event as MessageEvent).data;
      if (typeof data !== "string") {
        return;
      }
      let message: SignalKitEvent | SignalKitControl;
      try {
        message = JSON.parse(data);
      } catch {
        return;
      }
      this.receive(message);
    });
    socket.addEventListener("close", (event) => {
      const { code, reason } = event as CloseEvent;
      this.options.onClose?.({ code, reason });
      if (!this.closed && this.shouldReconnect(code)) {
        this.reconnectTimer = setTimeout(() => this.connect(), this.nextDelay());
      }
    });
    socket.addEventListener("error", (event) => this.options.onError?.(event));
    return this;
  }

  /** Close the connection and stop reconnecting. */
  close(): void {
    this.closed = true;
    clearTimeout(this.reconnectTimer);
    this.socket?.close();
  }

  /**
   * Listen for one kind of event (`"tip"`, `"chat.message"`, `"follow"`…), a raw platform type
   * (`"channel.cheer"`), or `"*"` for everything. Returns an unsubscribe function.
   */
  on<K extends EventKind>(kind: K, handler: Handler<EventOf<K>>): () => void;
  on(type: "*" | (string & {}), handler: Handler<SignalKitEvent>): () => void;
  on(type: string, handler: Handler<never>): () => void {
    const set = this.handlers.get(type) ?? new Set();
    set.add(handler as Handler<SignalKitEvent>);
    this.handlers.set(type, set);
    return () => set.delete(handler as Handler<SignalKitEvent>);
  }

  /** Like `on`, but only for the next matching event. */
  once<K extends EventKind>(kind: K, handler: Handler<EventOf<K>>): () => void;
  once(type: "*" | (string & {}), handler: Handler<SignalKitEvent>): () => void;
  once(type: string, handler: Handler<never>): () => void {
    const unsubscribe = this.on(type, async (event: SignalKitEvent) => {
      unsubscribe();
      await (handler as Handler<SignalKitEvent>)(event);
    });
    return unsubscribe;
  }

  off(type: string, handler: Handler<never>): void {
    this.handlers.get(type)?.delete(handler as Handler<SignalKitEvent>);
  }

  private receive(message: SignalKitEvent | SignalKitControl) {
    if (message.type === "signal_kit.ready") {
      this.attempt = 0;
      this.options.onReady?.(message as Extract<SignalKitControl, { type: "signal_kit.ready" }>);
      return;
    }
    if (message.type === "signal_kit.replayed") {
      this.options.onReplayed?.(message as Extract<SignalKitControl, { type: "signal_kit.replayed" }>);
      return;
    }
    const event = message as SignalKitEvent;
    if (event.v !== 2 || !event.id) {
      return;
    }
    // Replays and reconnects can overlap; deliver each event once.
    if (this.seen.has(event.id)) {
      return;
    }
    this.seen.add(event.id);
    if (this.seen.size > SEEN_LIMIT) {
      this.seen.delete(this.seen.values().next().value as string);
    }
    if (!this.lastId || event.id > this.lastId) {
      this.lastId = event.id;
    }
    const targets = new Set([...(this.handlers.get(event.kind) ?? []), ...(this.handlers.get(event.type) ?? []), ...(this.handlers.get("*") ?? [])]);
    for (const handler of targets) {
      void handler(event);
    }
  }

  private nextDelay() {
    if (typeof this.options.reconnectMs === "number") {
      return this.options.reconnectMs;
    }
    const config = this.options.reconnect || {};
    const min = config.minMs ?? 1000;
    const max = config.maxMs ?? 30_000;
    const delay = Math.min(max, min * 2 ** this.attempt);
    this.attempt += 1;
    return delay / 2 + Math.random() * (delay / 2);
  }

  private shouldReconnect(code: number) {
    if (this.options.reconnect === false || this.options.reconnectMs === false) {
      return false;
    }
    return !(this.options.terminalCloseCodes ?? [1002, 1003, 1007, 1008]).includes(code);
  }
}

export default SignalKit;
