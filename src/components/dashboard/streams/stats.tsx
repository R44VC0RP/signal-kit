import type { ReactNode } from "react";

/** Big-number stats in a hairline grid (no cards), with an optional change line. */
export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-4 border-t border-(--line)">{children}</div>;
}

export function Stat({ label, value, delta, sub }: { label: string; value: string; delta?: ReactNode; sub?: string }) {
  return (
    <div className="flex flex-col gap-1 border-b border-(--line) py-4 pr-4 [&:not(:nth-child(4n+1))]:border-l [&:not(:nth-child(4n+1))]:pl-4">
      <span className="text-xs text-(--text-3)">{label}</span>
      <span className="sk-brand text-[26px] leading-8 font-semibold tracking-[-0.01em] text-(--text) tabular-nums">{value}</span>
      <span className="flex min-h-4 items-center gap-2 text-[11px]">
        {delta}
        {sub ? <span className="text-(--text-3)">{sub}</span> : null}
      </span>
    </div>
  );
}

/** "+12%" against an earlier value; nothing when there's nothing to compare. */
export function Delta({ now, before }: { now: number; before: number | null | undefined }) {
  if (before === null || before === undefined || (before === 0 && now === 0)) {
    return null;
  }
  // Nothing to compare against (e.g. no streams in the earlier period).
  if (before === 0) {
    return null;
  }
  const change = Math.round(((now - before) / before) * 100);
  const tone = change > 0 ? "text-(--onair)" : change < 0 ? "text-[#ff8a80]" : "text-(--text-3)";
  return <span className={`sk-mono ${tone}`}>{`${change > 0 ? "+" : ""}${change}%`}</span>;
}

export function formatDuration(ms: number) {
  const minutes = Math.round(ms / 60_000);
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours}h ${String(minutes % 60).padStart(2, "0")}m` : `${minutes}m`;
}

export function formatTips(tips: Record<string, number>) {
  return Object.entries(tips)
    .sort(([, a], [, b]) => b - a)
    .map(([currency, value]) => {
      try {
        return new Intl.NumberFormat("en", { style: "currency", currency }).format(value);
      } catch {
        return `${value} ${currency}`;
      }
    })
    .join(" · ");
}

export function LiveDot() {
  return (
    <span className="inline-flex items-center gap-1.5 text-(--onair)">
      <span className="size-[7px] animate-pulse rounded-full bg-(--onair)" />
      Live
    </span>
  );
}
