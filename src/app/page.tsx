import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { PlatformLogo } from "@/components/dashboard/PlatformLogo";
import { buttonClass } from "@/components/dashboard/ui";
import { CopyIconButton } from "@/components/home/CopyIconButton";
import type { Platform } from "@/db/schema";

export const metadata: Metadata = {
  title: "Signal Kit · Every stream event, one socket",
  description: "Chat, follows, subs, tips and raids from Twitch, YouTube and X, normalized into one format and delivered over a single WebSocket.",
};

const INSTALL = "npm i @signal-kit/client";

/** Syntax tones: keyword, name, string, punctuation. */
type Tone = "k" | "n" | "s" | "p";
type Token = [string, Tone];

const SNIPPET: Token[][] = [
  [["import", "k"], [" { ", "p"], ["SignalKit", "n"], [" } ", "p"], ["from", "k"], [" ", "p"], ['"@signal-kit/client"', "s"], [";", "p"]],
  [],
  [
    ["const", "k"],
    [" ", "p"],
    ["kit", "n"],
    [" = ", "p"],
    ["new", "k"],
    [" ", "p"],
    ["SignalKit", "n"],
    ["({ token: process.env.", "p"],
    ["SIGNAL_KIT_KEY", "n"],
    [" });", "p"],
  ],
  [],
  [["kit", "n"], [".", "p"], ["on", "n"], ["(", "p"], ['"tip"', "s"], [", (e) => console.log(`${e.actor?.name} sent ${e.amount?.display}`));", "p"]],
  [["kit", "n"], [".", "p"], ["on", "n"], ["(", "p"], ['"chat.message"', "s"], [", (e) => console.log(e.actor?.name, e.message));", "p"]],
  [["kit", "n"], [".", "p"], ["connect", "n"], ["();", "p"]],
];

const SNIPPET_TEXT = SNIPPET.map((line) => line.map(([text]) => text).join("")).join("\n");

const TONE: Record<Tone, string> = {
  k: "text-(--text-3)",
  n: "text-(--text)",
  s: "text-(--accent-text)",
  p: "text-(--text-2)",
};

const OUTPUT: { platform: Platform; name: string; rest: string }[] = [
  { platform: "youtube", name: "mira.codes", rest: "sent $20.00" },
  { platform: "twitch", name: "pixelpilot", rest: "sent 500 bits" },
  { platform: "twitch", name: "devon_k", rest: "does the SDK work in Bun?" },
];

const EXAMPLES: { platform: Platform; label: string; actor: string; message: string; amount: [string, string, string] }[] = [
  { platform: "twitch", label: "Twitch cheer", actor: "pixelpilot", message: "the websocket is SO clean", amount: ["500", '"BITS"', '"500 bits"'] },
  { platform: "youtube", label: "YouTube Super Chat", actor: "mira.codes", message: "Take my money.", amount: ["20", '"USD"', '"$20.00"'] },
];

const DETAILS = [
  ["Replay on reconnect", "Events are kept for 24 hours. When the SDK reconnects it replays what you missed, without duplicates."],
  ["Push, not polling", "Twitch arrives through EventSub conduits, YouTube chat through the streamList gRPC push API."],
  ["Every channel you run", "Connect several accounts per platform. Each event says which channel it came from."],
  ["A CLI for the terminal", "The same events, streamed to your terminal while you build."],
];

export default function HomePage() {
  return (
    <div className="sk-app flex flex-1 justify-center px-5 sm:px-8">
      <div className="flex w-full max-w-4xl flex-col">
        <header className="flex h-15 items-center justify-between sm:h-18">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="sk-grain flex size-7 items-center justify-center rounded-(--r) bg-(--accent-fill)">
              <span className="size-2 rounded-full bg-white" />
            </span>
            <span className="sk-brand text-[15px] leading-5 font-semibold text-(--text)">Signal Kit</span>
          </Link>
          <Link href="/sign-in" className={`${buttonClass("control")} h-8 px-3.5`}>
            Sign in
          </Link>
        </header>

        <main className="flex flex-col">
          <section className="flex flex-col pt-12 sm:pt-30">
            <h1 className="sk-brand text-[36px] leading-10 font-semibold tracking-[-0.03em] text-balance text-(--text) sm:text-[56px] sm:leading-15">
              Every stream event.
              <br />
              One socket.
            </h1>
            <p className="mt-4 max-w-145 text-base leading-[25px] text-pretty text-(--text-2) sm:mt-5 sm:text-[17px] sm:leading-[27px]">
              Chat, follows, subs, tips and raids from Twitch, YouTube and X, normalized into one format and delivered over a single
              WebSocket.
            </p>
            <div className="mt-9 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3">
              <Link href="/sign-in" className={`${buttonClass("primary", "lg")} px-4.5`}>
                Get an API key
              </Link>
              <div className="flex h-10 items-center justify-between gap-3.5 rounded-(--r) border border-(--line) bg-(--surface-inset) pr-3 pl-3.5">
                <code className="sk-mono text-xs leading-4">
                  <span className="text-[#555555] select-none">$ </span>
                  <span className="text-(--text)">{INSTALL}</span>
                </code>
                <CopyIconButton value={INSTALL} label="Copy install command" />
              </div>
            </div>
            <ul className="mt-10 flex flex-wrap items-center gap-5 sm:mt-11 sm:gap-6">
              <PlatformItem platform="twitch" name="Twitch" />
              <PlatformItem platform="youtube" name="YouTube" />
              <PlatformItem platform="x" name="X">
                <span className="sk-mono rounded-sm border border-(--line-strong) px-1.5 py-0.75 text-[10px] leading-3 tracking-[0.04em] text-(--text-3)">
                  soon
                </span>
              </PlatformItem>
            </ul>
          </section>

          <Block title="Listen in a few lines" description="Create a key, then handle events by kind.">
            <Panel>
              <div className="flex h-10 items-center justify-between border-b border-(--line) px-5">
                <span className="sk-mono text-[11px] leading-3.5 text-(--text-2)">index.ts</span>
                <CopyIconButton value={SNIPPET_TEXT} label="Copy code" />
              </div>
              <pre className="sk-mono overflow-x-auto px-5 py-4.5 text-[11px] leading-6 sm:text-xs">
                {SNIPPET.map((line, index) => (
                  <div key={index} className="flex gap-5">
                    <span className="w-4 shrink-0 text-right text-[#555555] select-none">{index + 1}</span>
                    <code>
                      {line.length === 0
                        ? " "
                        : line.map(([text, tone], part) => (
                            <span key={part} className={TONE[tone]}>
                              {text}
                            </span>
                          ))}
                    </code>
                  </div>
                ))}
              </pre>
              <div className="border-t border-(--line) px-5 pt-3.5 pb-4.5">
                <div className="flex items-center justify-between pb-1.5">
                  <span className="sk-mono text-[11px] text-(--text-3)">Output</span>
                  <span className="inline-flex items-center gap-2 text-xs text-(--text-2)">
                    <span className="size-[7px] rounded-full bg-(--onair)" />
                    Listening
                  </span>
                </div>
                {OUTPUT.map((row) => (
                  <div key={row.name} className="sk-mono flex h-6 items-center gap-5 text-[11px] sm:text-xs">
                    <span className="flex w-4 shrink-0 justify-center">
                      <PlatformLogo platform={row.platform} size={12} />
                    </span>
                    <span className="truncate">
                      <span className="text-(--text)">{row.name}</span> <span className="text-(--text-2)">{row.rest}</span>
                    </span>
                  </div>
                ))}
              </div>
            </Panel>
          </Block>

          <Block
            title="One shape for every platform"
            description="A Twitch cheer and a YouTube Super Chat are both a tip with an amount. Write the handler once."
          >
            <Panel className="grid sm:grid-cols-2">
              {EXAMPLES.map((example, index) => (
                <div key={example.platform} className={index > 0 ? "border-t border-(--line) sm:border-t-0 sm:border-l" : ""}>
                  <div className="flex h-10 items-center gap-2.5 border-b border-(--line) px-5">
                    <span className="flex w-4 justify-center">
                      <PlatformLogo platform={example.platform} size={13} />
                    </span>
                    <span className="text-[13px] font-medium text-(--text)">{example.label}</span>
                  </div>
                  <pre className="sk-mono overflow-x-auto pt-4 pb-4.5 text-[11px] leading-[22px] text-(--text-2) sm:text-xs">
                    <JsonLine>{"{"}</JsonLine>
                    <JsonLine indent={1} highlight>
                      <Key strong>kind</Key>
                      <Str>&quot;tip&quot;</Str>,
                    </JsonLine>
                    <JsonLine indent={1}>
                      <Key>platform</Key>
                      <Str>&quot;{example.platform}&quot;</Str>,
                    </JsonLine>
                    <JsonLine indent={1}>
                      <Key>actor</Key>
                      {"{ "}
                      <Key>name</Key>
                      <Str>&quot;{example.actor}&quot;</Str>
                      {" },"}
                    </JsonLine>
                    <JsonLine indent={1}>
                      <Key>message</Key>
                      <Str>&quot;{example.message}&quot;</Str>,
                    </JsonLine>
                    <JsonLine indent={1}>
                      <Key>amount</Key>
                      {"{"}
                    </JsonLine>
                    <JsonLine indent={2}>
                      <Key>value</Key>
                      <span className="text-(--text)">{example.amount[0]}</span>,
                    </JsonLine>
                    <JsonLine indent={2}>
                      <Key>currency</Key>
                      <Str>{example.amount[1]}</Str>,
                    </JsonLine>
                    <JsonLine indent={2}>
                      <Key>display</Key>
                      <Str>{example.amount[2]}</Str>
                    </JsonLine>
                    <JsonLine indent={1}>{"}"}</JsonLine>
                    <JsonLine>{"}"}</JsonLine>
                  </pre>
                </div>
              ))}
            </Panel>
          </Block>

          <ul className="mt-20 flex flex-col border-b border-(--line) sm:mt-28">
            {DETAILS.map(([label, description]) => (
              <li key={label} className="flex flex-col gap-1 border-t border-(--line) py-4.5 sm:flex-row sm:gap-6 sm:py-5.5">
                <span className="text-[15px] leading-6 font-medium text-(--text) sm:w-106 sm:shrink-0">{label}</span>
                <span className="text-sm leading-[22px] text-pretty text-(--text-2) sm:text-[15px] sm:leading-6">{description}</span>
              </li>
            ))}
          </ul>

          <section className="mt-20 flex flex-col gap-5 sm:mt-28 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-1.5">
              <h2 className="sk-brand text-2xl leading-[30px] font-semibold tracking-[-0.02em] text-(--text)">Free. Sign in to start.</h2>
              <p className="text-sm leading-5 text-(--text-3)">Use any account you stream on. Connect the others afterwards.</p>
            </div>
            <Link href="/sign-in" className={`${buttonClass("primary", "lg")} px-4.5`}>
              Get an API key
            </Link>
          </section>
        </main>

        <footer className="mt-20 flex h-18 items-center justify-between border-t border-(--line) sm:mt-28">
          <span className="flex items-center gap-2">
            <span className="size-[7px] rounded-full bg-(--accent)" />
            <span className="sk-brand text-[13px] leading-4 font-semibold text-(--text-2)">Signal Kit</span>
          </span>
          <nav className="flex items-center gap-6 text-[13px] leading-4 text-(--text-3)">
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
      </div>
    </div>
  );
}

function PlatformItem({ platform, name, children }: { platform: Platform; name: string; children?: ReactNode }) {
  const size = { twitch: 15, youtube: 16, x: 15 }[platform];
  return (
    <li className="flex items-center gap-2">
      <span className="flex size-4.5 items-center justify-center">
        <PlatformLogo platform={platform} size={size} />
      </span>
      <span className="text-[13px] leading-4 font-medium text-(--text-2)">{name}</span>
      {children}
    </li>
  );
}

function Block({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="mt-20 flex flex-col gap-5 sm:mt-28">
      <div className="flex flex-col gap-1.5">
        <h2 className="sk-brand text-2xl leading-[30px] font-semibold tracking-[-0.02em] text-(--text)">{title}</h2>
        <p className="text-sm leading-5 text-pretty text-(--text-3)">{description}</p>
      </div>
      {children}
    </section>
  );
}

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`overflow-hidden rounded-xl border border-(--line) bg-(--surface-inset) ${className}`}>{children}</div>;
}

function JsonLine({ children, indent = 0, highlight = false }: { children: ReactNode; indent?: number; highlight?: boolean }) {
  return (
    <div
      className={`border-l-2 pr-5 ${highlight ? "border-(--accent) bg-(--selected)" : "border-transparent"}`}
      style={{ paddingLeft: `calc(18px + ${indent * 2}ch)` }}
    >
      {children}
    </div>
  );
}

function Key({ children, strong = false }: { children: ReactNode; strong?: boolean }) {
  return <span className={strong ? "text-(--text)" : "text-(--text-3)"}>&quot;{children}&quot;: </span>;
}

function Str({ children }: { children: ReactNode }) {
  return <span className="text-(--accent-text)">{children}</span>;
}
