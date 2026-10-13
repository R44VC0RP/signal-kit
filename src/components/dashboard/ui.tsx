import type { ReactNode } from "react";

type ButtonKind = "control" | "primary" | "quiet";

/** Button look shared by <button>, <a> and ConnectButton. Filled buttons get the grain texture. */
export function buttonClass(kind: ButtonKind = "control", size: "sm" | "lg" = "sm") {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-(--r) font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent) disabled:cursor-not-allowed disabled:opacity-50";
  const sizing = size === "lg" ? "h-10 px-4 text-sm" : "h-7 px-3 text-[13px]";
  const look = {
    control: "sk-grain bg-(--control) text-(--text) hover:bg-(--control-hover)",
    primary: "sk-grain bg-(--accent-fill) text-white hover:bg-(--accent-fill-hover)",
    quiet: "text-(--text-2) hover:bg-(--hover) hover:text-(--text)",
  }[kind];
  return `${base} ${sizing} ${look}`;
}

export function PageHeader({ title, description, actions }: { title: string; description: string; actions?: ReactNode }) {
  return (
    <header className="flex items-end justify-between gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="sk-brand text-[34px] leading-10 font-semibold tracking-[-0.02em] text-(--text)">{title}</h1>
        <p className="text-[13px] text-(--text-3)">{description}</p>
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/** A titled group of rows separated by hairlines. No card chrome on purpose. */
export function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col">
      <div className="flex h-12 items-center justify-between gap-4">
        <h2 className="text-[13px] font-semibold text-(--text)">{title}</h2>
        {aside}
      </div>
      <div className="flex flex-col">{children}</div>
    </section>
  );
}

export function Row({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`flex min-h-14 items-center gap-3.5 border-t border-(--line) ${className}`}>{children}</div>;
}

export type StatusTone = "ok" | "warn" | "error" | "off";

export function Status({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  const dot = { ok: "bg-(--onair)", warn: "bg-(--warning)", error: "bg-(--danger)", off: "bg-[#555555]" }[tone];
  const text = tone === "warn" || tone === "error" ? "text-(--text)" : tone === "off" ? "text-(--text-3)" : "text-(--text-2)";
  return (
    <span className="inline-flex items-center gap-2 text-[13px]">
      <span className={`size-[7px] shrink-0 rounded-full ${dot}`} />
      <span className={text}>{children}</span>
    </span>
  );
}

export function Muted({ children }: { children: ReactNode }) {
  return <span className="text-xs text-(--text-3)">{children}</span>;
}
