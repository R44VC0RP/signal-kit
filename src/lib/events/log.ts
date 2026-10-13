import type { SignalKitEvent } from "./types";

/** What the dashboard's event log needs: the event without its raw platform payload. */
export type LogEvent = Pick<SignalKitEvent, "v" | "id" | "kind" | "platform" | "actor" | "message" | "amount" | "data" | "occurredAt" | "receivedAt">;

export function toLogEvent(event: SignalKitEvent): LogEvent {
  const { v, id, kind, platform, actor, message, amount, data, occurredAt, receivedAt } = event;
  return { v, id, kind, platform, actor, message, amount, data, occurredAt, receivedAt };
}
