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
  var DEFAULT_URL = "wss://signal.ryan.ceo/ws";
  var SEEN_LIMIT = 1e3;
  var SignalKit = class {
    constructor(options) {
      this.options = options;
      if (!options.token) {
        throw new Error("SignalKit: `token` is required.");
      }
      this.lastId = options.since;
    }
    options;
    socket;
    handlers = /* @__PURE__ */ new Map();
    reconnectTimer;
    attempt = 0;
    closed = false;
    lastId;
    seen = /* @__PURE__ */ new Set();
    /** Id of the newest event received, for resuming later with `since`. */
    get lastEventId() {
      return this.lastId;
    }
    /** Open the connection. No-op if already open or connecting. */
    connect() {
      if (this.socket && (this.socket.readyState === 0 || this.socket.readyState === 1)) {
        return this;
      }
      clearTimeout(this.reconnectTimer);
      this.closed = false;
      const WebSocketImpl = this.options.WebSocket ?? globalThis.WebSocket;
      if (!WebSocketImpl) {
        throw new Error("SignalKit: no WebSocket constructor found. Pass `WebSocket` in options.");
      }
      const socket = new WebSocketImpl(this.options.url ?? DEFAULT_URL);
      this.socket = socket;
      socket.addEventListener("open", () => {
        socket.send(JSON.stringify({ type: "auth", token: this.options.token, since: this.lastId }));
        this.options.onOpen?.();
      });
      socket.addEventListener("message", (event) => {
        const data = event.data;
        if (typeof data !== "string") {
          return;
        }
        let message;
        try {
          message = JSON.parse(data);
        } catch {
          return;
        }
        this.receive(message);
      });
      socket.addEventListener("close", (event) => {
        const { code, reason } = event;
        this.options.onClose?.({ code, reason });
        if (!this.closed && this.shouldReconnect(code)) {
          this.reconnectTimer = setTimeout(() => this.connect(), this.nextDelay());
        }
      });
      socket.addEventListener("error", (event) => this.options.onError?.(event));
      return this;
    }
    /** Close the connection and stop reconnecting. */
    close() {
      this.closed = true;
      clearTimeout(this.reconnectTimer);
      this.socket?.close();
    }
    on(type, handler) {
      const set = this.handlers.get(type) ?? /* @__PURE__ */ new Set();
      set.add(handler);
      this.handlers.set(type, set);
      return () => set.delete(handler);
    }
    once(type, handler) {
      const unsubscribe = this.on(type, async (event) => {
        unsubscribe();
        await handler(event);
      });
      return unsubscribe;
    }
    off(type, handler) {
      this.handlers.get(type)?.delete(handler);
    }
    receive(message) {
      if (message.type === "signal_kit.ready") {
        this.attempt = 0;
        this.options.onReady?.(message);
        return;
      }
      if (message.type === "signal_kit.replayed") {
        this.options.onReplayed?.(message);
        return;
      }
      const event = message;
      if (event.v !== 2 || !event.id) {
        return;
      }
      if (this.seen.has(event.id)) {
        return;
      }
      this.seen.add(event.id);
      if (this.seen.size > SEEN_LIMIT) {
        this.seen.delete(this.seen.values().next().value);
      }
      if (!this.lastId || event.id > this.lastId) {
        this.lastId = event.id;
      }
      const targets = /* @__PURE__ */ new Set([...this.handlers.get(event.kind) ?? [], ...this.handlers.get(event.type) ?? [], ...this.handlers.get("*") ?? []]);
      for (const handler of targets) {
        void handler(event);
      }
    }
    nextDelay() {
      if (typeof this.options.reconnectMs === "number") {
        return this.options.reconnectMs;
      }
      const config = this.options.reconnect || {};
      const min = config.minMs ?? 1e3;
      const max = config.maxMs ?? 3e4;
      const delay = Math.min(max, min * 2 ** this.attempt);
      this.attempt += 1;
      return delay / 2 + Math.random() * (delay / 2);
    }
    shouldReconnect(code) {
      if (this.options.reconnect === false || this.options.reconnectMs === false) {
        return false;
      }
      return !(this.options.terminalCloseCodes ?? [1002, 1003, 1007, 1008]).includes(code);
    }
  };
  var index_default = SignalKit;
  return __toCommonJS(index_exports);
})();
globalThis.SignalKit = __SignalKitBundle.SignalKit; globalThis.SignalKitClient = __SignalKitBundle.SignalKit;
//# sourceMappingURL=twe-client.js.map