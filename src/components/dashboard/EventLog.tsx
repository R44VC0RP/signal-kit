"use client";

import { useEffect, useRef, useState } from "react";
import type { Platform } from "@/db/schema";
import { describeEvent, type DescribedEvent, type EventCategory } from "@/lib/events/describe";
import type { LogEvent } from "@/lib/events/log";
import type { SignalKitEvent } from "@/lib/events/types";
import { XVerifiedBadge } from "@/components/brand/x";
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
const MAX_ROWS = 2000;

function toRow(event: Partial<SignalKitEvent>): Row | null {
  const described = describeEvent(event);
  if (!described) {
    return null;
  }
  return { ...described, id: event.id ?? crypto.randomUUID(), time: event.occurredAt ?? event.receivedAt ?? new Date().toISOString() };
}

/**
 * The user's stored events (kept 24 hours) followed live, over the same socket apps use
 * (authenticated by session). The socket resumes from the newest event shown, so nothing
 * arriving between page load and connect, or during a reconnect, is missed or doubled.
 */
export function EventLog({
  platforms,
  initialEvents,
  initialHasMore,
}: {
  platforms: Platform[];
  initialEvents: LogEvent[];
  initialHasMore: boolean;
}) {
  const [rows, setRows] = useState<Row[]>(() => initialEvents.map((event) => toRow(event)).filter((row): row is Row => row !== null));
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const seen = useRef(new Set(initialEvents.map((event) => event.id)));
  const lastId = useRef<string | undefined>(initialEvents[0]?.id);
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
      const since = lastId.current ? `?since=${encodeURIComponent(lastId.current)}` : "";
      ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws${since}`);
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
        if (parsed.id) {
          if (seen.current.has(parsed.id)) {
            return;
          }
          seen.current.add(parsed.id);
          if (!lastId.current || parsed.id > lastId.current) {
            lastId.current = parsed.id;
          }
        }
        const row = toRow(parsed);
        if (!row) {
          return;
        }
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

  const loadOlder = async () => {
    const oldest = rows.at(-1)?.id;
    if (!oldest || loadingOlder) {
      return;
    }
    setLoadingOlder(true);
    try {
      const response = await fetch(`/api/events?before=${encodeURIComponent(oldest)}&limit=100`);
      if (!response.ok) {
        return;
      }
      const page = (await response.json()) as { events: LogEvent[]; hasMore: boolean };
      const older = page.events.filter((event) => !seen.current.has(event.id));
      older.forEach((event) => seen.current.add(event.id));
      setRows((current) => [...current, ...older.map((event) => toRow(event)).filter((row): row is Row => row !== null)]);
      setHasMore(page.hasMore);
    } finally {
      setLoadingOlder(false);
    }
  };

  const visible = rows.filter((row) => (filter === "all" || row.category === filter) && !hidden.has(row.platform));
  const newest = rows[0]?.id;

  return (
    <>
      <PageHeader
        title="Events"
        description="Everything from the last 24 hours, then live as your apps receive it."
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
          <span className="w-40 shrink-0">From</span>
          <span className="flex-1">Details</span>
          <span className="w-20 shrink-0 text-right">Value</span>
        </div>
        {visible.length === 0 ? (
          <p className="border-t border-(--line) px-2.5 py-10 text-center text-[13px] text-(--text-3)">
            {rows.length > 0
              ? "No events match these filters."
              : status === "listening"
              ? "No events in the last 24 hours. New ones show up here the moment they happen on stream."
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
                className={`flex h-10 items-center gap-3.5 border-t border-(--line) px-2.5 ${fresh ? "bg-(--selected)" : ""}`}
              >
                <span className="sk-mono w-17.5 shrink-0 text-[11px] text-(--text-3)">
                  {new Date(row.time).toLocaleTimeString("en", { hour12: false })}
                </span>
                <span className="flex w-4 shrink-0 justify-center">
                  <PlatformLogo platform={row.platform} size={13} />
                </span>
                <span className={`w-32.5 shrink-0 truncate text-xs ${fresh ? "text-(--accent-text)" : "text-(--text-2)"}`}>{row.kind}</span>
                <span className="flex w-40 shrink-0 items-center gap-2">
                  {row.from ? <Avatar name={row.from} url={row.avatarUrl} /> : null}
                  {row.badgeImages.map((badge) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={badge.url} src={badge.url} alt={badge.title} title={badge.title} width={14} height={14} className="size-3.5 shrink-0 rounded-[2px]" referrerPolicy="no-referrer" />
                  ))}
                  <span className="truncate text-[13px] font-medium text-(--text)">{row.from || "—"}</span>
                  {row.xVerified ? <XVerifiedBadge type={row.xVerified} size={14} /> : null}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-(--text-2)">{row.details}</span>
                <span className="sk-mono w-20 shrink-0 text-right text-xs text-(--text)">{row.value}</span>
              </div>
            );
          })
        )}
        {hasMore ? (
          <div className="flex justify-center border-t border-(--line) py-4">
            <button type="button" className={buttonClass("control")} disabled={loadingOlder} onClick={() => void loadOlder()}>
              {loadingOlder ? "Loading…" : "Load older"}
            </button>
          </div>
        ) : rows.length > 0 ? (
          <p className="border-t border-(--line) px-2.5 py-4 text-center text-xs text-(--text-3)">Events are kept for 24 hours.</p>
        ) : null}
      </div>
    </>
  );
}

/** Sender avatar, or their initial when the platform sends no picture (e.g. Twitch chat). */
function Avatar({ name, url }: { name: string; url: string | null }) {
  const [failed, setFailed] = useState(false);
  if (url && !failed) {
    return (
      // Remote avatars from many CDNs; next/image would need every host allow-listed.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        width={18}
        height={18}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="size-4.5 shrink-0 rounded-full bg-(--control) object-cover outline outline-1 -outline-offset-1 outline-white/10"
      />
    );
  }
  return (
    <span className="flex size-4.5 shrink-0 items-center justify-center rounded-full bg-(--control) text-[10px] font-semibold text-(--text-2) uppercase">
      {name.replace(/^@/, "").charAt(0)}
    </span>
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
