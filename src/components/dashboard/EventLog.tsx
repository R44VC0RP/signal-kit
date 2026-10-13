"use client";

import { useEffect, useRef, useState } from "react";
import type { Platform } from "@/db/schema";
import { describeEvent, type DescribedEvent, type EventCategory } from "@/lib/events/describe";
import type { SignalKitEvent } from "@/lib/events/types";
import { PlatformLogo, PLATFORM_NAME } from "./PlatformLogo";
import { buttonClass, PageHeader } from "./ui";

type Row = DescribedEvent & { id: string; time: string };
type Status = "connecting" | "listening" | "offline";

const FILTERS: { value: "all" | EventCategory; label: string }[] = [
  { value: "all", label: "All" },
  { value: "chat", label: "Chat" },
  { value: "alerts", label: "Alerts" },
  { value: "money", label: "Money" },
];
const MAX_ROWS = 300;

/** Live view of the user's relay stream, over the same socket apps use (authenticated by session). */
export function EventLog({ platforms }: { platforms: Platform[] }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState<Status>("connecting");
  const [paused, setPaused] = useState(false);
  const [filter, setFilter] = useState<"all" | EventCategory>("all");
  const [hidden, setHidden] = useState<Set<Platform>>(new Set());
  const pausedRef = useRef(paused);
  const buffer = useRef<Row[]>([]);

  useEffect(() => {
    pausedRef.current = paused;
    if (!paused && buffer.current.length > 0) {
      const flushed = buffer.current;
      buffer.current = [];
      setRows((current) => [...flushed, ...current].slice(0, MAX_ROWS));
    }
  }, [paused]);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let closed = false;

    const connect = () => {
      setStatus("connecting");
      ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`);
      ws.onmessage = (message) => {
        let parsed: Partial<SignalKitEvent> & { type?: string };
        try {
          parsed = JSON.parse(String(message.data));
        } catch {
          return;
        }
        if (parsed.type === "signal_kit.ready") {
          setStatus("listening");
          return;
        }
        const described = describeEvent(parsed);
        if (!described) {
          return;
        }
        const row: Row = { ...described, id: parsed.id ?? crypto.randomUUID(), time: parsed.occurredAt ?? parsed.receivedAt ?? new Date().toISOString() };
        if (pausedRef.current) {
          buffer.current = [row, ...buffer.current].slice(0, MAX_ROWS);
        } else {
          setRows((current) => [row, ...current].slice(0, MAX_ROWS));
        }
      };
      ws.onclose = (event) => {
        setStatus("offline");
        // 1008 means not signed in; retrying won't help.
        if (!closed && event.code !== 1008) {
          retry = setTimeout(connect, 3000);
        }
      };
    };
    connect();
    return () => {
      closed = true;
      clearTimeout(retry);
      ws?.close();
    };
  }, []);

  const visible = rows.filter((row) => (filter === "all" || row.category === filter) && !hidden.has(row.platform));
  const newest = rows[0]?.id;

  return (
    <>
      <PageHeader
        title="Events"
        description="Everything arriving on your socket, as your apps receive it."
        actions={
          <>
            <StatusPill status={status} />
            <button type="button" className={buttonClass("control")} onClick={() => setPaused((value) => !value)}>
              {paused ? "Resume" : "Pause"}
            </button>
          </>
        }
      />
      <div className="flex items-center justify-between gap-4">
        <div className="inline-flex rounded-(--r) border border-(--line) bg-(--surface-inset) p-0.5" role="radiogroup" aria-label="Event type">
          {FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={filter === option.value}
              onClick={() => setFilter(option.value)}
              className={`h-5.5 rounded-[4px] px-2.5 text-xs font-medium ${
                filter === option.value ? "sk-grain bg-(--control) text-(--text)" : "text-(--text-3) hover:text-(--text)"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          {platforms.map((platform) => {
            const off = hidden.has(platform);
            return (
              <button
                key={platform}
                type="button"
                aria-pressed={!off}
                onClick={() =>
                  setHidden((current) => {
                    const next = new Set(current);
                    if (next.has(platform)) {
                      next.delete(platform);
                    } else {
                      next.add(platform);
                    }
                    return next;
                  })
                }
                className={`inline-flex h-6.5 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium text-(--text-2) ${
                  off ? "border-(--line) opacity-45" : "border-[#444]"
                }`}
              >
                <PlatformLogo platform={platform} size={13} />
                {PLATFORM_NAME[platform]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="-mt-4 flex flex-col">
        <div className="flex h-8 items-center gap-3.5 px-2.5 text-xs text-(--text-3)">
          <span className="w-17.5 shrink-0">Time</span>
          <span className="w-4 shrink-0" />
          <span className="w-32.5 shrink-0">Type</span>
          <span className="w-32.5 shrink-0">From</span>
          <span className="flex-1">Details</span>
          <span className="w-20 shrink-0 text-right">Value</span>
        </div>
        {visible.length === 0 ? (
          <p className="border-t border-(--line) px-2.5 py-10 text-center text-[13px] text-(--text-3)">
            {status === "listening"
              ? "Listening. Events show up here the moment they happen on stream."
              : status === "connecting"
                ? "Connecting…"
                : "Disconnected. Retrying…"}
          </p>
        ) : (
          visible.map((row) => {
            const fresh = row.id === newest;
            return (
              <div
                key={row.id}
                className={`flex h-10 items-center gap-3.5 border-t border-(--line) px-2.5 ${fresh ? "bg-(--selected) shadow-[inset_3px_0_0_var(--accent)]" : ""}`}
              >
                <span className="sk-mono w-17.5 shrink-0 text-[11px] text-(--text-3)">
                  {new Date(row.time).toLocaleTimeString("en", { hour12: false })}
                </span>
                <span className="flex w-4 shrink-0 justify-center">
                  <PlatformLogo platform={row.platform} size={13} />
                </span>
                <span className={`w-32.5 shrink-0 truncate text-xs ${fresh ? "text-(--accent-text)" : "text-(--text-2)"}`}>{row.kind}</span>
                <span className="w-32.5 shrink-0 truncate text-[13px] font-medium text-(--text)">{row.from || "—"}</span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-(--text-2)">{row.details}</span>
                <span className="sk-mono w-20 shrink-0 text-right text-xs text-(--text)">{row.value}</span>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}

function StatusPill({ status }: { status: Status }) {
  const look =
    status === "listening"
      ? "sk-grain bg-(--onair-fill) text-[#06210d]"
      : status === "connecting"
        ? "bg-(--control) text-(--text-2)"
        : "bg-[rgb(255_77_67/15%)] text-(--danger-text)";
  const dot = status === "listening" ? "bg-[#06210d]" : status === "connecting" ? "bg-(--text-3)" : "bg-(--danger)";
  return (
    <span className={`inline-flex h-6.5 items-center gap-1.5 rounded-full px-3 text-xs font-semibold ${look}`}>
      <span className={`size-[7px] rounded-full ${dot}`} />
      {status === "listening" ? "Listening" : status === "connecting" ? "Connecting" : "Offline"}
    </span>
  );
}
