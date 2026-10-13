import type { OverlayType } from "@/lib/overlays/settings";

const PATHS: Record<OverlayType, React.ReactNode> = {
  alerts: <path d="M6 8a6 6 0 1112 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 003.4 0" />,
  chat: <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />,
  events: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  goal: <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7" />,
  label: <path d="M4 7V4h16v3M9 20h6M12 4v16" />,
  emotewall: <path d="M12 22a10 10 0 100-20 10 10 0 000 20zM8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" />,
  ticker: <path d="M2 12h20M17 7l5 5-5 5M2 6h9M2 18h9" />,
};

export function TypeIcon({ type }: { type: OverlayType }) {
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-(--r) border border-(--line) bg-(--surface-inset) text-(--text-2)">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {PATHS[type]}
      </svg>
    </span>
  );
}
