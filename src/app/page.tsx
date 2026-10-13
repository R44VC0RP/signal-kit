import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { HomeDemo, type DemoScene } from "@/components/home/HomeDemo";
import { PlatformLogo } from "@/components/dashboard/PlatformLogo";
import { buttonClass } from "@/components/dashboard/ui";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import type { Platform } from "@/db/schema";
import { LIBRARY_ART, LIBRARY_SOUNDS } from "@/lib/library";
import scenesJson from "@/lib/home/scenes.json";
import { OVERLAY_TYPES } from "@/lib/overlays/settings";
import { THEMES } from "@/lib/overlays/themes";

export const metadata: Metadata = {
  title: "Signal Kit · Free stream overlays for Twitch, YouTube and X",
  description:
    "Free alerts, chat box, goals, live tools, a chat bot and stream stats for Twitch, YouTube and X at the same time. Pick a look and add it to OBS in one click.",
};

const SCENES = scenesJson as (DemoScene & { title?: string })[];
const FALLBACK: DemoScene = { id: "sample", game: "Sample stream", image: "/preview/stream-sample.jpg", imageSmall: "/preview/stream-sample.jpg" };

const PLATFORMS: { platform: Platform; name: string; sends: string }[] = [
  { platform: "twitch", name: "Twitch", sends: "Chat, follows, subs and gift subs, bits, raids, channel points, polls, predictions, hype trains" },
  { platform: "youtube", name: "YouTube", sends: "Live chat, Super Chats, Super Stickers, memberships and gifted memberships" },
  { platform: "x", name: "X", sends: "Live chat, follows, subscriptions, going live and ending" },
];

const CHAT: { platform: Platform; name: string; color: string; text: string; badge?: string }[] = [
  { platform: "twitch", name: "PixelPilot", color: "#9acd32", text: "that clutch was insane" },
  { platform: "youtube", name: "mira.codes", color: "#2ba640", text: "watching from YouTube 👋" },
  { platform: "x", name: "devon_k", color: "#1d9bf0", text: "came over from X, the overlay looks clean" },
  { platform: "twitch", name: "lowlatency", color: "#ff7f50", text: "!vote 2" },
  { platform: "youtube", name: "Ana Ruiz", color: "#ffd600", text: "Super Chat · $20.00 · love the stream!", badge: "tip" },
];

export default function HomePage() {
  const overlayCount = OVERLAY_TYPES.length;
  return (
    <div className="sk-app flex flex-1 justify-center px-5 sm:px-8">
      <div className="flex w-full max-w-6xl flex-col">
        <SiteHeader>
          <a href="#features" className="hidden text-[13px] text-(--text-2) transition-colors hover:text-(--text) sm:inline">
            Features
          </a>
          <Link href="/developers" className="hidden text-[13px] text-(--text-2) transition-colors hover:text-(--text) sm:inline">
            Developers
          </Link>
        </SiteHeader>

        <main className="flex flex-col">
          {/* ---- Hero ---- */}
          <section className="flex flex-col items-center pt-12 text-center sm:pt-20">
            <ul className="flex items-center gap-4">
              {PLATFORMS.map(({ platform, name }) => (
                <li key={platform} className="inline-flex items-center gap-1.5 text-[13px] text-(--text-2)">
                  <PlatformLogo platform={platform} size={14} />
                  {name}
                </li>
              ))}
            </ul>
            <h1 className="sk-brand mt-6 max-w-200 text-[40px] leading-[44px] font-semibold tracking-[-0.035em] text-balance text-(--text) sm:text-[68px] sm:leading-[72px]">
              Look pro on stream in two minutes.
            </h1>
            <p className="mt-5 max-w-150 text-base leading-[25px] text-pretty text-(--text-2) sm:text-lg sm:leading-[28px]">
              Free alerts, chat, goals and live tools for Twitch, YouTube and X at the same time. Pick a look, click once, and it&apos;s in OBS.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
              <Link href="/sign-in" className={`${buttonClass("primary", "lg")} px-5`}>
                Start free
              </Link>
              <a href="#demo" className={`${buttonClass("control", "lg")} px-5`}>
                See it live
              </a>
            </div>
            <p className="mt-3 text-xs text-(--text-3)">Sign in with Twitch, YouTube or X. No download, no credit card.</p>
          </section>

          <section id="demo" className="mt-12 scroll-mt-6 sm:mt-16">
            <HomeDemo scenes={SCENES} fallback={FALLBACK} />
          </section>

          {/* ---- Multistream ---- */}
          <Block
            id="features"
            eyebrow="One chat for every platform"
            title="Three chats. One screen."
            description="Streaming to more than one platform? Every message, follow, sub, bit and Super Chat lands in one chat box and one set of alerts, with each platform's emotes and badges."
          >
            <div className="grid gap-10 border-t border-(--line) pt-8 lg:grid-cols-[1fr_440px]">
              <ul className="flex flex-col">
                {PLATFORMS.map(({ platform, name, sends }) => (
                  <li key={platform} className="flex gap-4 border-b border-(--line) py-5 first:pt-0">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-(--r) border border-(--line) bg-(--surface-inset)">
                      <PlatformLogo platform={platform} size={17} />
                    </span>
                    <div className="flex flex-col gap-1">
                      <span className="text-[15px] font-medium text-(--text)">{name}</span>
                      <span className="text-sm leading-[22px] text-(--text-2)">{sends}</span>
                    </div>
                  </li>
                ))}
                <li className="pt-5 text-sm leading-[22px] text-(--text-3)">Twitch emotes, BTTV, FFZ and 7TV show up as images, animated ones included.</li>
              </ul>
              <MockChat />
            </div>
          </Block>

          {/* ---- Looks ---- */}
          <Block
            eyebrow="Themes, art and sounds"
            title="Pick a look. Every overlay matches."
            description={`${THEMES.length} theme packs restyle all your overlays at once. Then choose art and sounds for each alert from a free library you're allowed to use on stream and in VODs.`}
          >
            <div className="grid grid-cols-3 border-t border-(--line) sm:grid-cols-3">
              <Stat value={String(THEMES.length)} label="theme packs" />
              <Stat value={String(LIBRARY_ART.length)} label="pieces of alert art, many animated" />
              <Stat value={String(LIBRARY_SOUNDS.length)} label="alert sounds" />
            </div>
            <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
              {LIBRARY_ART.filter((item) => item.animated)
                .slice(0, 16)
                .map((item) => (
                  <div key={item.id} className="flex aspect-square items-center justify-center rounded-[10px] border border-(--line) bg-(--surface-inset)">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.url} alt={item.name} loading="lazy" className="size-3/5 object-contain" />
                  </div>
                ))}
            </div>
          </Block>

          {/* ---- Overlays ---- */}
          <Block eyebrow={`${overlayCount} overlays`} title="Everything you'd put on stream." description="Each one is a browser source with its own settings: fonts, colours, animations, sizes, filters. Change it in the dashboard and it updates in OBS right away.">
            <ul className="grid border-t border-(--line) sm:grid-cols-2 lg:grid-cols-3">
              {OVERLAY_TYPES.map((info) => (
                <li key={info.type} className="flex flex-col gap-1 border-b border-(--line) py-4 pr-6">
                  <span className="text-[15px] font-medium text-(--text)">{info.name}</span>
                  <span className="text-sm leading-[21px] text-(--text-3)">{info.description}</span>
                </li>
              ))}
            </ul>
          </Block>

          {/* ---- Live tools + bot ---- */}
          <Block
            eyebrow="Live tools"
            title="Get chat playing along, on every platform."
            description="Run polls, giveaways, a viewer queue and a spin wheel from your dashboard. Viewers on Twitch, YouTube and X join by typing in chat, and it all shows on stream."
          >
            <div className="grid gap-10 border-t border-(--line) pt-8 lg:grid-cols-2">
              <MockPoll />
              <ul className="flex flex-col">
                {[
                  ["Chat polls", "Viewers type 1, 2 or 3. One vote each, live results on screen."],
                  ["Giveaways", "Viewers type a keyword to enter, then a fair random draw with a winner reveal."],
                  ["Viewer queue", "!join to get in line to play with you. You call the next one."],
                  ["Pin a message", "Click any chat message and it appears on stream."],
                  ["Chat bot for Twitch", "Commands, timed messages, spam filters, shoutouts, clips and stream markers."],
                  ["Loyalty points", "Viewers earn points by chatting and watching, and spend them in your store."],
                ].map(([title, text]) => (
                  <li key={title} className="flex flex-col gap-0.5 border-b border-(--line) py-3.5 first:pt-0">
                    <span className="text-[15px] font-medium text-(--text)">{title}</span>
                    <span className="text-sm leading-[21px] text-(--text-3)">{text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Block>

          {/* ---- Stats ---- */}
          <Block
            eyebrow="Stream stats"
            title="See how every stream went."
            description="Each stream is logged on its own: viewers, chatters, new faces, follows, subs and support, per platform. Get a recap in your Discord when you end."
          >
            <MockStats />
          </Block>

          {/* ---- Setup ---- */}
          <Block eyebrow="Setup" title="In OBS with one click." description="Signal Kit connects to OBS on your computer and adds every overlay, sized and placed. Using something else? Paste one link as a browser source.">
            <ol className="grid border-t border-(--line) sm:grid-cols-3">
              {[
                ["Sign in", "With Twitch, YouTube or X. Connect your other platforms after."],
                ["Pick a look", "Choose a theme and an alert pack, or keep the classic look."],
                ["Add to OBS", "One click with OBS 28 or newer. Works in Streamlabs Desktop, XSplit, Meld and vMix with a link."],
              ].map(([title, text], index) => (
                <li key={title} className="flex flex-col gap-2 border-b border-(--line) py-6 pr-8 sm:border-b-0">
                  <span className="sk-mono text-xs text-(--accent-text)">{String(index + 1).padStart(2, "0")}</span>
                  <span className="text-[17px] font-medium text-(--text)">{title}</span>
                  <span className="text-sm leading-[22px] text-(--text-3)">{text}</span>
                </li>
              ))}
            </ol>
          </Block>

          {/* ---- FAQ ---- */}
          <Block eyebrow="Questions" title="Good to know.">
            <dl className="grid border-t border-(--line) sm:grid-cols-2 sm:gap-x-12">
              {[
                ["Is it free?", "Yes. Overlays, live tools, the chat bot and stream stats are free to use."],
                ["Do I need to download anything?", "No. Everything runs in your browser and in OBS as browser sources."],
                ["Which platforms work?", "Twitch, YouTube and X, together or on their own."],
                ["Can I keep using my other tools?", "Yes. Signal Kit overlays are normal browser sources, so they sit next to anything else in your scenes."],
                ["Is my account safe?", "Signal Kit only asks for the permissions it uses, and your platform tokens are stored encrypted. You can disconnect any time."],
                ["Can I build my own?", "Yes. Developers get every event from all three platforms through one SDK."],
              ].map(([question, answer]) => (
                <div key={question} className="flex flex-col gap-1.5 border-b border-(--line) py-5">
                  <dt className="text-[15px] font-medium text-(--text)">{question}</dt>
                  <dd className="text-sm leading-[22px] text-(--text-2)">{answer}</dd>
                </div>
              ))}
            </dl>
          </Block>

          {/* ---- Developers ---- */}
          <section className="mt-16 flex flex-col gap-3 rounded-xl border border-(--line) bg-(--surface-inset) px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-[15px] font-medium text-(--text)">Building your own overlay or bot?</span>
              <span className="text-sm text-(--text-3)">Every chat message and event from Twitch, YouTube and X, in one format, over one WebSocket.</span>
            </div>
            <Link href="/developers" className={buttonClass("control")}>
              For developers
            </Link>
          </section>

          {/* ---- CTA ---- */}
          <section className="mt-20 flex flex-col items-center gap-4 text-center sm:mt-28">
            <h2 className="sk-brand text-[32px] leading-[38px] font-semibold tracking-[-0.03em] text-(--text) sm:text-[44px] sm:leading-[50px]">Set it up before your next stream.</h2>
            <p className="text-[15px] text-(--text-2)">Free. Takes about two minutes.</p>
            <Link href="/sign-in" className={`${buttonClass("primary", "lg")} mt-2 px-5`}>
              Start free
            </Link>
          </section>
        </main>

        <SiteFooter />
      </div>
    </div>
  );
}

function Block({ id, eyebrow, title, description, children }: { id?: string; eyebrow: string; title: string; description?: string; children: ReactNode }) {
  return (
    <section id={id} className="mt-24 flex scroll-mt-6 flex-col gap-8 sm:mt-32">
      <div className="flex max-w-170 flex-col gap-3">
        <span className="sk-mono text-[11px] tracking-[0.08em] text-(--accent-text) uppercase">{eyebrow}</span>
        <h2 className="sk-brand text-[30px] leading-[36px] font-semibold tracking-[-0.03em] text-balance text-(--text) sm:text-[40px] sm:leading-[46px]">{title}</h2>
        {description ? <p className="text-[15px] leading-6 text-pretty text-(--text-2) sm:text-base sm:leading-[26px]">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col gap-1 border-b border-(--line) py-5 pr-4 [&:not(:first-child)]:border-l [&:not(:first-child)]:pl-5">
      <span className="sk-brand text-[34px] leading-10 font-semibold tracking-[-0.02em] text-(--text)">{value}</span>
      <span className="text-sm text-(--text-3)">{label}</span>
    </div>
  );
}

/** A static, Classic-style chat box with lines from all three platforms. */
function MockChat() {
  return (
    <div className="relative overflow-hidden rounded-xl border border-(--line) bg-[linear-gradient(160deg,#25304a,#141a28_55%,#20182a)] p-5">
      <div className="flex flex-col gap-2 font-[Roboto,sans-serif] text-[15px] leading-[22px] font-bold text-white [text-shadow:0_0_1px_#000,0_0_2px_#000]">
        {CHAT.map((line) => (
          <div key={line.name} className={line.badge ? "rounded-md bg-[#32c3a6]/25 px-2 py-1" : ""}>
            <span className="mr-1.5 inline-flex translate-y-[2px]">
              <PlatformLogo platform={line.platform} size={13} />
            </span>
            <span style={{ color: line.color }}>{line.name}</span>
            <span>: </span>
            <span>{line.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MockPoll() {
  const options: [string, number, Record<Platform, number>][] = [
    ["Elden Ring", 38, { twitch: 22, youtube: 11, x: 5 }],
    ["Balatro", 51, { twitch: 30, youtube: 14, x: 7 }],
    ["Minecraft hardcore", 11, { twitch: 7, youtube: 3, x: 1 }],
  ];
  const colors: Record<Platform, string> = { twitch: "#9146ff", youtube: "#ff0033", x: "#e7e9ea" };
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-(--line) bg-(--surface-inset) p-5">
      <div className="flex items-baseline justify-between">
        <span className="text-[15px] font-medium text-(--text)">What should we play next?</span>
        <span className="sk-mono text-xs text-(--text-3)">1:24 left</span>
      </div>
      {options.map(([label, percent, split], index) => (
        <div key={label} className="flex flex-col gap-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-(--text)">
              <span className="sk-mono mr-2 text-(--accent-text)">{index + 1}</span>
              {label}
            </span>
            <span className="sk-mono text-(--text-2)">{percent}%</span>
          </div>
          <div className="flex h-2 overflow-hidden rounded-full bg-(--control)">
            {(["twitch", "youtube", "x"] as Platform[]).map((platform) => (
              <span key={platform} style={{ width: `${split[platform]}%`, background: colors[platform] }} />
            ))}
          </div>
        </div>
      ))}
      <span className="text-xs text-(--text-3)">Votes from Twitch, YouTube and X chat. Sample poll.</span>
    </div>
  );
}

function MockStats() {
  const bars = [62, 70, 58, 81, 77, 90, 86, 104, 97, 121];
  return (
    <div className="grid gap-8 border-t border-(--line) pt-8 lg:grid-cols-[1fr_1.2fr]">
      <div className="grid grid-cols-2 gap-y-6">
        {[
          ["Peak viewers", "121"],
          ["Chatters", "48"],
          ["New chatters", "12"],
          ["New followers", "23"],
        ].map(([label, value]) => (
          <div key={label} className="flex flex-col gap-1">
            <span className="text-sm text-(--text-3)">{label}</span>
            <span className="sk-brand text-[30px] leading-9 font-semibold text-(--text)">{value}</span>
          </div>
        ))}
        <span className="col-span-2 text-xs text-(--text-3)">Sample numbers.</span>
      </div>
      <div className="flex flex-col gap-3 rounded-xl border border-(--line) bg-(--surface-inset) p-5">
        <span className="text-sm text-(--text-2)">Peak viewers, last 10 streams</span>
        <div className="flex h-36 items-end gap-2">
          {bars.map((value, index) => (
            <span key={index} className="flex-1 rounded-t-[3px] bg-(--accent-fill) opacity-80" style={{ height: `${(value / 121) * 100}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
}
