import Link from "next/link";
import type { Platform } from "@/db/schema";
import { totals, type StreamSummary } from "@/lib/streams/summary";

/** Brand colours for chart series (X's mark is white on dark). */
export const PLATFORM_COLOR: Record<Platform, string> = { twitch: "#9146ff", youtube: "#ff0033", x: "#e7e9ea" };
const ORDER: Platform[] = ["twitch", "youtube", "x"];

export function compact(value: number) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: value < 10_000 ? 1 : 0 }).format(value);
}

/**
 * Viewers per platform as lines (top) and chat messages per minute as bars (bottom), over
 * the length of one stream.
 */
export function TimelineChart({ summary, startedAt }: { summary: StreamSummary; startedAt: string }) {
  const points = summary.timeline;
  const platforms = ORDER.filter((p) => summary.platforms[p]);
  if (points.length < 2) {
    return <p className="border-t border-(--line) py-6 text-[13px] text-(--text-3)">The chart fills in after a couple of minutes live.</p>;
  }
  const W = 960;
  const H = 260;
  const viewersH = 150;
  const chatTop = 180;
  const chatH = H - chatTop - 20;
  const x = (i: number) => (i / (points.length - 1)) * W;
  const maxViewers = Math.max(1, ...points.flatMap((p) => platforms.map((pl) => p.v[pl] ?? 0)));
  const chatTotal = (p: (typeof points)[number]) => platforms.reduce((sum, pl) => sum + (p.m[pl] ?? 0), 0);
  const maxChat = Math.max(1, ...points.map(chatTotal));
  const barW = Math.max(1, W / points.length - 1);
  const start = Date.parse(startedAt);
  // A time label roughly every 6th of the stream, on a round number of minutes.
  const step = [5, 10, 15, 30, 60, 120].find((s) => points.length / s <= 7) ?? 240;
  const ticks = Array.from({ length: Math.floor((points.length - 1) / step) + 1 }, (_, i) => i * step);
  const time = (minutes: number) => new Date(start + minutes * 60_000).toLocaleTimeString("en", { hour: "numeric", minute: "2-digit" });

  return (
    <div className="flex flex-col gap-3 border-t border-(--line) pt-4">
      <div className="flex items-center gap-4 text-xs text-(--text-3)">
        {platforms.filter((p) => summary.platforms[p]?.viewerSamples).map((p) => (
          <span key={p} className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-3 rounded-full" style={{ background: PLATFORM_COLOR[p] }} />
            {p === "x" ? "X" : p === "youtube" ? "YouTube" : "Twitch"} viewers
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-[2px] bg-[#4a4a4a]" />
          Chat messages per minute
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full overflow-visible" role="img" aria-label="Viewers and chat over the stream">
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={0} x2={W} y1={viewersH * (1 - f) + 8} y2={viewersH * (1 - f) + 8} stroke="#242424" strokeWidth={1} />
            <text x={W} y={viewersH * (1 - f) + 4} textAnchor="end" className="fill-[#8f8f8f] font-mono text-[10px]">
              {compact(Math.round(maxViewers * f))}
            </text>
          </g>
        ))}
        {platforms.map((p) => {
          const path = points
            .map((point, i) => (point.v[p] === undefined ? null : `${x(i).toFixed(1)},${(8 + viewersH - ((point.v[p] ?? 0) / maxViewers) * viewersH).toFixed(1)}`))
            .filter(Boolean);
          return path.length > 1 ? <polyline key={p} points={path.join(" ")} fill="none" stroke={PLATFORM_COLOR[p]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" /> : null;
        })}
        {points.map((point, i) => {
          const total = chatTotal(point);
          if (!total) {
            return null;
          }
          const h = Math.max(1, (total / maxChat) * chatH);
          return (
            <rect key={i} x={x(i) - barW / 2} y={chatTop + chatH - h} width={barW} height={h} fill="#4a4a4a">
              <title>{`${time(i)}: ${total} messages`}</title>
            </rect>
          );
        })}
        <text x={W} y={chatTop - 4} textAnchor="end" className="fill-[#8f8f8f] font-mono text-[10px]">
          {`${compact(maxChat)}/min`}
        </text>
        {ticks.map((minuteIndex) => (
          <text key={minuteIndex} x={Math.min(W - 30, x(minuteIndex))} y={H} textAnchor={minuteIndex === 0 ? "start" : "middle"} className="fill-[#8f8f8f] font-mono text-[10px]">
            {time(minuteIndex)}
          </text>
        ))}
      </svg>
    </div>
  );
}

/** Chatters per stream, stacked by platform, oldest on the left. Each bar opens that stream. */
export function StreamsTrend({ streams }: { streams: { id: string; startedAt: string; summary: StreamSummary }[] }) {
  const recent = [...streams].reverse().slice(-24);
  if (recent.length < 2) {
    return null;
  }
  const max = Math.max(1, ...recent.map((stream) => totals(stream.summary).chatters));
  return (
    <div className="flex h-44 items-end justify-end gap-1.5 border-t border-(--line) pt-4">
      {recent.map((stream) => {
        const t = totals(stream.summary);
        const date = new Date(stream.startedAt).toLocaleDateString("en", { month: "short", day: "numeric" });
        return (
          <Link
            key={stream.id}
            href={`/dashboard/streams/${stream.id}`}
            title={`${date}: ${t.chatters} chatters, ${t.messages} messages, peak ${t.peakViewers} viewers`}
            className="group flex h-full max-w-14 min-w-0 flex-1 flex-col justify-end gap-1.5"
          >
            <span className="flex flex-col-reverse overflow-hidden rounded-[3px] opacity-85 transition-opacity group-hover:opacity-100" style={{ height: `${Math.max(2, (t.chatters / max) * 100)}%` }}>
              {ORDER.map((p) => {
                const share = stream.summary.platforms[p]?.chatters ?? 0;
                return share ? <span key={p} style={{ flexGrow: share, background: PLATFORM_COLOR[p] }} /> : null;
              })}
              {t.chatters === 0 ? <span className="flex-1 bg-(--line-strong)" /> : null}
            </span>
            <span className="sk-mono truncate text-center text-[10px] text-(--text-3)">{date}</span>
          </Link>
        );
      })}
    </div>
  );
}
