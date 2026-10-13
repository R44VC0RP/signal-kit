import Link from "next/link";
import type { ReactNode } from "react";
import { buttonClass } from "@/components/dashboard/ui";

/** Top bar for public pages (homepage, docs). */
export function SiteHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="flex h-15 items-center justify-between sm:h-18">
      <Link href="/" className="flex items-center gap-2.5">
        <span className="sk-grain flex size-7 items-center justify-center rounded-(--r) bg-(--accent-fill)">
          <span className="size-2 rounded-full bg-white" />
        </span>
        <span className="sk-brand text-[15px] leading-5 font-semibold text-(--text)">Signal Kit</span>
      </Link>
      <nav className="flex items-center gap-5">
        {children}
        <Link href="/sign-in" className={`${buttonClass("control")} h-8 px-3.5`}>
          Sign in
        </Link>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-20 flex h-18 items-center justify-between border-t border-(--line) sm:mt-28">
      <span className="flex items-center gap-2">
        <span className="size-[7px] rounded-full bg-(--accent)" />
        <span className="sk-brand text-[13px] leading-4 font-semibold text-(--text-2)">Signal Kit</span>
      </span>
      <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] leading-4 text-(--text-3)">
        <Link href="/developers" className="transition-colors hover:text-(--text)">
          Developers
        </Link>
        <Link href="/docs" className="transition-colors hover:text-(--text)">
          Docs
        </Link>
        <Link href="/credits" className="transition-colors hover:text-(--text)">
          Credits
        </Link>
        <Link href="/dashboard" className="transition-colors hover:text-(--text)">
          Dashboard
        </Link>
        <Link href="/privacy" className="transition-colors hover:text-(--text)">
          Privacy
        </Link>
        <Link href="/terms" className="transition-colors hover:text-(--text)">
          Terms
        </Link>
      </nav>
    </footer>
  );
}
