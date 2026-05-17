"use strict";
var __SignalKitBundle = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/index.ts
  var index_exports = {};
  __export(index_exports, {
    SignalKit: () => SignalKit,
    default: () => index_default
  });
  var DEFAULT_RECONNECT_MS = 2e3;
  var SignalKit = class {
    constructor(options) {
      this.options = options;
      if (!options.url) {
        throw new Error("SignalKit: `url` is required.");
      }
      if (!options.token) {
        throw new Error("SignalKit: `token` is required.");
      }
    }
    options;
    socket;
    handlers = /* @__PURE__ */ new Map();
    reconnectTimer;
    closed = false;
    /**
     * Open the relay connection. Calling `connect()` multiple times is a no-op
     * if the socket is already open or connecting.
     */
    connect() {
      if (this.socket && (this.socket.readyState === 0 || this.socket.readyState === 1)) {
        return this;
      }
      clearTimeout(this.reconnectTimer);
      this.closed = false;
      const WebSocketImpl = this.options.WebSocket ?? globalThis.WebSocket;
      if (!WebSocketImpl) {
        throw new Error(
          "SignalKit: no WebSocket constructor found. Pass `WebSocket` in options or run on a platform with a global WebSocket."
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
        const data = "data" in event ? event.data : void 0;
        if (typeof data !== "string") {
          return;
        }
        let message;
        try {
          message = JSON.parse(data);
        } catch {
          return;
        }
        this.dispatch(message);
      });
      socket.addEventListener?.("close", (event) => {
        const closeEvent = event;
        this.options.onClose?.({ code: closeEvent.code, reason: closeEvent.reason });
        if (!this.closed && this.options.reconnectMs !== false && this.shouldReconnect(closeEvent.code)) {
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
    close() {
      this.closed = true;
      clearTimeout(this.reconnectTimer);
      this.socket?.close();
    }
    /**
     * Subscribe to a specific event type. Pass `"*"` to receive every message.
     * Returns an unsubscribe function.
     */
    on(type, handler) {
      const handlers = this.handlers.get(type) ?? /* @__PURE__ */ new Set();
      handlers.add(handler);
      this.handlers.set(type, handlers);
      return () => {
        handlers.delete(handler);
      };
    }
    /** Subscribe once. Handler is removed after the first matching message. */
    once(type, handler) {
      const unsubscribe = this.on(type, async (message) => {
        unsubscribe();
        await handler(message);
      });
      return unsubscribe;
    }
    /** Remove a previously registered handler. */
    off(type, handler) {
      this.handlers.get(type)?.delete(handler);
    }
    dispatch(message) {
      this.handlers.get(message.type)?.forEach((handler) => {
        void handler(message);
      });
      this.handlers.get("*")?.forEach((handler) => {
        void handler(message);
      });
    }
    shouldReconnect(code) {
      const terminalCodes = this.options.terminalCloseCodes ?? [1002, 1003, 1007, 1008];
      return !terminalCodes.includes(code);
    }
  };
  var index_default = SignalKit;
  return __toCommonJS(index_exports);
})();
globalThis.SignalKit = __SignalKitBundle.SignalKit; globalThis.SignalKitClient = __SignalKitBundle.SignalKit;
//# sourceMappingURL=twe-client.js.map