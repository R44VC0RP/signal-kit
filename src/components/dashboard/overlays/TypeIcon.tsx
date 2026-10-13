import type { OverlayType } from "@/lib/overlays/settings";

const PATHS: Record<OverlayType, React.ReactNode> = {
  alerts: <path d="M6 8a6 6 0 1112 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 003.4 0" />,
  chat: <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />,
  events: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  goal: <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7" />,
  label: <path d="M4 7V4h16v3M9 20h6M12 4v16" />,
  emotewall: <path d="M12 22a10 10 0 100-20 10 10 0 000 20zM8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" />,
  ticker: <path d="M2 12h20M17 7l5 5-5 5M2 6h9M2 18h9" />,
  poll: <path d="M4 20V10M10 20V4M16 20v-6M22 20H2" />,
  giveaway: <path d="M20 12v9H4v-9M2 7h20v5H2zM12 21V7M12 7H7.5a2.5 2.5 0 110-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z" />,
  queue: <path d="M8 6h13M8 12h13M8 18h13M3 6h1M3 12h1M3 18h1" />,
  highlight: <path d="M12 17v5M9 10.76V6a3 3 0 016 0v4.76l3 3.24v2H6v-2z" />,
  viewers: <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z" />,
  credits: <path d="M7 4h10M5 9h14M7 14h10M9 19h6" />,
  wheel: <path d="M12 22a10 10 0 100-20 10 10 0 000 20zM12 2v20M2 12h20M4.9 4.9l14.2 14.2M19.1 4.9L4.9 19.1" />,
  boss: <path d="M12 2l3 5 6 1-4.5 4 1 6-5.5-3-5.5 3 1-6L3 8l6-1z" />,
  twitch: <path d="M4 3h17v11l-5 5h-4l-3 3H7v-3H4zM11 8v4M16 8v4" />,
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
