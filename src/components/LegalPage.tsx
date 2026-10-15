import Link from "next/link";
import type { ReactNode } from "react";

export const CONTACT_EMAIL = "signal@ryan.ceo";
export const LEGAL_UPDATED = "October 16, 2026";

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="sk-app flex flex-1 justify-center px-6 py-16">
      <article className="flex w-full max-w-170 flex-col gap-6 text-[15px] leading-[25px] text-(--text-2) [&_a]:text-(--accent-text) [&_a]:underline [&_a]:underline-offset-2 [&_h2]:pt-4 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-(--text) [&_li]:ml-5 [&_li]:list-disc [&_strong]:font-semibold [&_strong]:text-(--text) [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5">
        <Link href="/" className="sk-brand text-sm font-semibold text-(--text)! no-underline!">
          Signal Kit
        </Link>
        <header className="flex flex-col gap-2">
          <h1 className="sk-brand text-[34px] leading-10 font-semibold tracking-[-0.02em] text-(--text)">{title}</h1>
          <p className="text-[13px] text-(--text-3)">Last updated {LEGAL_UPDATED}</p>
        </header>
        {children}
      </article>
    </main>
  );
}
