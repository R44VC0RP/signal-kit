/**
 * @signal-kit/client
 *
 * Minimal WebSocket client for Signal Kit. Subscribe to Twitch EventSub
 * notifications using a relay token. Works in browsers, Bun, and Node 22+.
 */

export type SignalKitMessage<E = unknown> = {
  /** Twitch EventSub subscription type, e.g. "channel.cheer". Also "signal_kit.ready". */
  type: string;
  /** The Twitch EventSub subscription metadata. */
  subscription?: {
    id?: string;
    type?: string;
    version?: string;
    [key: string]: unknown;
  };
  /** The raw Twitch event payload. */
  event?: E;
  /** ISO 8601 timestamp when Signal Kit received the message. */
  receivedAt: string;
};

export type SignalKitOptions = {
  /** Relay WebSocket URL, e.g. "wss://signal.ryan.ceo/ws". */
  url: string;
  /** Relay token issued by the Signal Kit dashboard. */
  token: string;
  /**
   * Optional WebSocket constructor. Defaults to `globalThis.WebSocket`.
   * Pass `import("ws").WebSocket` for older Node versions.
   */
  WebSocket?: typeof WebSocket;
  /** Auto-reconnect delay in milliseconds. Default `2000`. Set `false` to disable. */
  reconnectMs?: number | false;
  /** Called when the underlying socket opens. */
  onOpen?: () => void;
  /** Called when the underlying socket closes. */
  onClose?: (event: { code: number; reason: string }) => void;
  /** Called when the underlying socket errors. */
  onError?: (error: unknown) => void;
};

type Handler<E = unknown> = (message: SignalKitMessage<E>) => void | Promise<void>;

const DEFAULT_RECONNECT_MS = 2_000;

export class SignalKit {
  private socket?: WebSocket;
  private handlers = new Map<string, Set<Handler>>();
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private closed = false;

  constructor(private readonly options: SignalKitOptions) {
    if (!options.url) {
      throw new Error("SignalKit: `url` is required.");
    }
    if (!options.token) {
      throw new Error("SignalKit: `token` is required.");
    }
  }

  /**
   * Open the relay connection. Calling `connect()` multiple times is a no-op
   * if the socket is already open or connecting.
   */
  connect(): this {
    if (this.socket && (this.socket.readyState === 0 || this.socket.readyState === 1)) {
      return this;
    }

    this.closed = false;
    const WebSocketImpl = this.options.WebSocket ?? globalThis.WebSocket;
    if (!WebSocketImpl) {
      throw new Error(
        "SignalKit: no WebSocket constructor found. Pass `WebSocket` in options or run on a platform with a global WebSocket.",
      );
    }

    const url = new URL(this.options.url);
    url.searchParams.set("token", this.options.token);

    const socket = new WebSocketImpl(url.toString());
    this.socket = socket;

    socket.addEventListener?.("open", () => {
      this.options.onOpen?.();
    });
    socket.addEventListener?.("message", (event) => {
      const data = "data" in event ? (event as MessageEvent).data : undefined;
      if (typeof data !== "string") {
        return;
      }
      let message: SignalKitMessage;
      try {
        message = JSON.parse(data);
      } catch {
        return;
      }
      this.dispatch(message);
    });
    socket.addEventListener?.("close", (event) => {
      const closeEvent = event as CloseEvent;
      this.options.onClose?.({ code: closeEvent.code, reason: closeEvent.reason });
      if (!this.closed && this.options.reconnectMs !== false) {
        const delay = typeof this.options.reconnectMs === "number" ? this.options.reconnectMs : DEFAULT_RECONNECT_MS;
        this.reconnectTimer = setTimeout(() => this.connect(), delay);
      }
    });
    socket.addEventListener?.("error", (event) => {
      this.options.onError?.(event);
    });

    return this;
  }

  /** Close the relay connection and stop auto-reconnect. */
  close(): void {
    this.closed = true;
    clearTimeout(this.reconnectTimer);
    this.socket?.close();
  }

  /**
   * Subscribe to a specific event type. Pass `"*"` to receive every message.
   * Returns an unsubscribe function.
   */
  on<E = unknown>(type: string, handler: Handler<E>): () => void {
    const handlers = this.handlers.get(type) ?? new Set<Handler>();
    handlers.add(handler as Handler);
    this.handlers.set(type, handlers);
    return () => {
      handlers.delete(handler as Handler);
    };
  }

  /** Subscribe once. Handler is removed after the first matching message. */
  once<E = unknown>(type: string, handler: Handler<E>): () => void {
    const unsubscribe = this.on<E>(type, async (message) => {
      unsubscribe();
      await handler(message);
    });
    return unsubscribe;
  }

  /** Remove a previously registered handler. */
  off(type: string, handler: Handler): void {
    this.handlers.get(type)?.delete(handler);
  }

  private dispatch(message: SignalKitMessage): void {
    this.handlers.get(message.type)?.forEach((handler) => {
      void handler(message);
    });
    this.handlers.get("*")?.forEach((handler) => {
      void handler(message);
    });
  }
}

export default SignalKit;
