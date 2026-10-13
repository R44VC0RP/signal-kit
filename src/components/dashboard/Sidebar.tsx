"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { authClient } from "@/lib/auth-client";

const icon = (d: ReactNode) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
);

const NAV = [
  { href: "/dashboard", label: "Overview", icon: icon(<path d="M3 10.5L12 3l9 7.5V21H3z" />) },
  { href: "/dashboard/connections", label: "Connections", count: "connections", icon: icon(<path d="M9 17H7A5 5 0 017 7h2M15 7h2a5 5 0 010 10h-2M8 12h8" />) },
  { href: "/dashboard/streams", label: "Streams", icon: icon(<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />) },
  { href: "/dashboard/overlays", label: "Overlays", count: "overlays", icon: icon(<><path d="M12 3l9 5-9 5-9-5z" /><path d="M3 13l9 5 9-5" /></>) },
  { href: "/dashboard/library", label: "Library", icon: icon(<><path d="M4 19V5a1 1 0 011-1h3v16H5a1 1 0 01-1-1zM8 4h4v16H8z" /><path d="M14.5 5.5l3.9-1 3.6 14.5-3.9 1z" /></>) },
  { href: "/dashboard/keys", label: "API keys", count: "keys", icon: icon(<><circle cx="7.5" cy="15.5" r="4.5" /><path d="M10.7 12.3L20 3M17 6l3 3" /></>) },
  { href: "/dashboard/events", label: "Events", icon: icon(<path d="M3 12h4l3-8 4 16 3-8h4" />) },
] as const;

export function Sidebar({
  user,
  counts,
}: {
  user: { name: string; email: string; image: string | null };
  counts: { connections: number; keys: number; overlays: number };
}) {
  const pathname = usePathname();
  const initials = user.name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <aside className="sticky top-0 flex h-dvh w-58 shrink-0 flex-col gap-1 border-r border-(--line) bg-(--surface-panel) px-2.5 py-3.5">
      <Link href="/dashboard" className="flex items-center gap-2.5 px-2 pt-1.5 pb-4.5">
        <span className="sk-grain flex size-7 items-center justify-center rounded-(--r) bg-(--accent-fill)">
          <span className="size-2 rounded-full bg-white" />
        </span>
        <span className="sk-brand text-sm font-semibold text-(--text)">Signal Kit</span>
      </Link>

      <nav className="flex flex-col gap-1" aria-label="Dashboard">
        {NAV.map((item) => {
          const active = item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href);
          const count = "count" in item ? counts[item.count] : null;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex h-8 items-center gap-2.5 rounded-(--r) px-2.5 text-[13px] ${
                active ? "sk-grain bg-(--accent-fill) font-semibold text-white" : "text-(--text-2) hover:bg-(--hover) hover:text-(--text)"
              }`}
            >
              <span className={active ? "text-white" : "text-(--text-3)"}>{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {count ? <span className={`text-xs ${active ? "text-white/75" : "text-(--text-3)"}`}>{count}</span> : null}
            </Link>
          );
        })}
      </nav>

      <div className="flex-1" />
      <Link href="/docs" className="flex h-8 items-center gap-2.5 rounded-(--r) px-2.5 text-[13px] text-(--text-2) hover:bg-(--hover) hover:text-(--text)">
        <span className="text-(--text-3)">{icon(<><path d="M4 4h11l5 5v11H4z" /><path d="M15 4v5h5" /></>)}</span>
        Docs
      </Link>
      <div className="mt-1.5 flex items-center gap-2.5 border-t border-(--line) px-2 pt-2.5">
        <span className="flex size-6.5 shrink-0 items-center justify-center rounded-full bg-[#3a3a3a] text-[11px] font-semibold text-(--text)">
          {initials || "?"}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[13px] text-(--text)">{user.name}</span>
          <span className="truncate text-[11px] text-(--text-3)">{user.email}</span>
        </span>
        <button
          type="button"
          title="Sign out"
          aria-label="Sign out"
          className="rounded-(--r) p-1 text-(--text-3) hover:bg-(--hover) hover:text-(--text)"
          onClick={async () => {
            await authClient.signOut();
            window.location.assign("/sign-in");
          }}
        >
          {icon(<><path d="M15 4h4v16h-4" /><path d="M10 8l-4 4 4 4M6 12h10" /></>)}
        </button>
      </div>
    </aside>
  );
}
