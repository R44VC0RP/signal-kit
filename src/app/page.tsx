import type { Metadata } from "next";
import Link from "next/link";
import { PlatformLogo } from "@/components/dashboard/PlatformLogo";
import { buttonClass } from "@/components/dashboard/ui";
import { HomeShowcase, PollScene } from "@/components/home/HomeShowcase";
import { SiteFooter } from "@/components/site/SiteChrome";

export const metadata: Metadata = {
  title: "Signal Kit · Free stream overlays for Twitch, YouTube and X",
  description: "Free overlays and live tools for Twitch, YouTube and X. Runs in your browser and OBS. Nothing to download.",
};

const VIDEO = { webm: "/home/scenes/hero.webm", mp4: "/home/scenes/hero.mp4", poster: "/home/scenes/hero.webp" };

const TOOLS: [string, string, string][] = [
  ["Chat polls", "Live results on stream.", "1 · 2 · 3"],
  ["Giveaways", "A fair draw with a winner reveal.", "!enter"],
  ["Viewer queue", "Line up to play with you.", "!join"],
  ["Pin a message", "Put any chat message on screen.", "click"],
];

const FAQ: [string, string][] = [
  ["Is it free?", "Yes. Overlays, live tools, the chat bot and stream stats are free. No credit card."],
  ["Do I need to download anything?", "No. Everything runs in your browser and shows up in OBS as browser sources."],
  ["Which platforms work?", "Twitch, YouTube and X, together or on their own. Sign in with one and connect the others after."],
  ["I don't use OBS. Does it still work?", "Yes. Paste one link as a browser source in Streamlabs Desktop, XSplit, Meld or vMix. OBS 28 and newer get one-click setup."],
];

const NAV: [string, string][] = [
  ["Overlays", "#overlays"],
  ["Live tools", "#live-tools"],
  ["Developers", "/developers"],
];

export default function HomePage() {
  return (
    <div className="sk-app flex flex-1 justify-center px-5 sm:px-8">
      <div className="flex w-full max-w-6xl flex-col">
        <header className="flex h-15 items-center justify-between gap-6 sm:h-18">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="sk-grain flex size-7 items-center justify-center rounded-(--r) bg-(--accent-fill)">
              <span className="size-2 rounded-full bg-white" />
            </span>
            <span className="sk-brand text-[15px] leading-5 font-semibold text-(--text)">Signal Kit</span>
          </Link>
          <nav className="hidden items-center gap-7 md:flex">
            {NAV.map(([label, href]) => (
              <Link key={label} href={href} className="text-[13px] text-(--text-2) transition-colors hover:text-(--text)">
                {label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/sign-in" className={`${buttonClass("control")} h-8 px-3.5`}>
              Sign in
            </Link>
            <Link href="/sign-in" className={`${buttonClass("primary")} h-8 px-3.5`}>
              Start free
            </Link>
          </div>
        </header>

        <main className="flex flex-col">
          {/* ---- Hero ---- */}
          <section className="grid gap-6 pt-10 sm:pt-16 lg:grid-cols-[1fr_380px] lg:items-end lg:gap-16">
            <h1 className="sk-brand text-[48px] leading-[50px] font-semibold tracking-[-0.04em] text-(--text) sm:text-[88px] sm:leading-[86px]">
              Look pro on
              <br />
              stream.
            </h1>
            <div className="flex flex-col gap-5 pb-2">
              <p className="text-base leading-[25px] text-pretty text-(--text-2)">Free overlays and live tools for Twitch, YouTube and X. Runs in your browser and OBS. Nothing to download.</p>
              <div className="flex items-center gap-4">
                <Link href="/sign-in" className={`${buttonClass("primary", "lg")} px-5`}>
                  Start free
                </Link>
                <span className="text-[13px] text-(--text-3)">Takes about two minutes</span>
              </div>
            </div>
          </section>

          <section id="overlays" className="mt-10 scroll-mt-6 sm:mt-14">
            <HomeShowcase video={VIDEO.webm} fallbackVideo={VIDEO.mp4} poster={VIDEO.poster} />
          </section>

          {/* ---- Live tools ---- */}
          <section id="live-tools" className="mt-24 grid scroll-mt-6 gap-10 sm:mt-32 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-14">
            <PollScene poster={VIDEO.poster} />
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-3">
                <h2 className="sk-brand text-[34px] leading-[38px] font-semibold tracking-[-0.03em] text-(--text) sm:text-[44px] sm:leading-[48px]">Let chat play along.</h2>
                <p className="text-[15px] leading-6 text-(--text-2)">Viewers on Twitch, YouTube and X take part by typing in chat. No extension, no extra account.</p>
                <span className="flex items-center gap-2.5">
                  <PlatformLogo platform="twitch" size={20} />
                  <PlatformLogo platform="youtube" size={20} />
                  <PlatformLogo platform="x" size={18} />
                </span>
              </div>
              <ul className="flex flex-col">
                {TOOLS.map(([title, text, command]) => (
                  <li key={title} className="flex items-center justify-between gap-4 border-t border-(--line) py-3.5">
                    <span className="flex flex-col gap-0.5">
                      <span className="text-[15px] font-medium text-(--text)">{title}</span>
                      <span className="text-[13px] text-(--text-3)">{text}</span>
                    </span>
                    <span className="sk-mono shrink-0 text-xs text-(--accent-text)">{command}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* ---- FAQ ---- */}
          <section className="mt-24 grid gap-8 sm:mt-32 lg:grid-cols-[1fr_1.5fr] lg:gap-14">
            <h2 className="sk-brand text-[34px] leading-[38px] font-semibold tracking-[-0.03em] text-(--text) sm:text-[44px] sm:leading-[48px]">Good to know.</h2>
            <dl className="flex flex-col border-b border-(--line)">
              {FAQ.map(([question, answer]) => (
                <div key={question} className="flex flex-col gap-1.5 border-t border-(--line) py-5">
                  <dt className="text-[15px] font-medium text-(--text)">{question}</dt>
                  <dd className="text-sm leading-[22px] text-(--text-2)">{answer}</dd>
                </div>
              ))}
            </dl>
          </section>

          {/* ---- CTA ---- */}
          <section className="mt-28 flex flex-col items-center gap-5 text-center sm:mt-40">
            <h2 className="sk-brand max-w-150 text-[38px] leading-[42px] font-semibold tracking-[-0.035em] text-balance text-(--text) sm:text-[60px] sm:leading-[62px]">
              Your next stream can look like this.
            </h2>
            <Link href="/sign-in" className={`${buttonClass("primary", "lg")} px-5`}>
              Start free
            </Link>
            <p className="text-[13px] text-(--text-3)">Sign in with Twitch, YouTube or X. Takes about two minutes.</p>
          </section>
        </main>

        <SiteFooter />
      </div>
    </div>
  );
}
