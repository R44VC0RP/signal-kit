import { EventEmitter } from "events";

/**
 * In-process notifications about connection changes, so platform workers react immediately
 * instead of waiting for their next periodic sync. Workers still re-sync from the database,
 * which stays the source of truth.
 */
type ConnectionEvents = {
  changed: [connectionId: string];
  removed: [connectionId: string];
};

const globalForEvents = globalThis as typeof globalThis & {
  __signalKitConnectionEvents?: EventEmitter<ConnectionEvents>;
};

export const connectionEvents = (globalForEvents.__signalKitConnectionEvents ??= new EventEmitter<ConnectionEvents>());
