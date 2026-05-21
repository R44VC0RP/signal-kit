import Link from "next/link";
import { CodeBlock } from "@/components/CodeBlock";
import { Logo } from "@/components/Logo";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <ProviderModes />
        <LivePreview />
        <CodeSection />
        <Prose />
        <Faq />
        <Outro />
      </main>
      <SiteFooter />
    </>
  );
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-6">
        <Logo />
        <nav className="flex items-center gap-1 text-sm text-neutral-600">
          <Link
            href="/docs"
            className="rounded-md px-3 py-2 hover:bg-neutral-100 hover:text-neutral-950"
          >
            Docs
          </Link>
          <Link
            href="/dashboard"
            className="rounded-md px-3 py-2 hover:bg-neutral-100 hover:text-neutral-950"
          >
            Dashboard
          </Link>
        </nav>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section>
      <div className="mx-auto w-full max-w-3xl px-6 pt-16 pb-10 sm:pt-24">
        <h1 className="max-w-[28ch] text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          One event stream for Twitch, YouTube, or both.
        </h1>
        <p className="mt-5 max-w-[60ch] text-pretty text-neutral-600">
          Start with the platform you use today. Connect Twitch EventSub, YouTube Live Chat, or
          both, then pipe subs, cheers, redemptions, Super Chats, and live messages into whatever
          you build.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
          <a
            href="/api/auth/twitch/start"
            className="inline-flex items-center justify-center rounded-md bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-violet-600 hover:bg-violet-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600"
          >
            Continue with Twitch
          </a>
          <a
            href="/api/auth/youtube/start"
            className="inline-flex items-center justify-center rounded-md border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
          >
            Continue with YouTube
          </a>
          <Link
            href="/docs"
            className="text-sm font-semibold text-neutral-950 underline-offset-4 hover:underline"
          >
            Read the docs <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}

function ProviderModes() {
  const modes = [
    {
      label: "Twitch only",
      title: "EventSub without webhook plumbing",
      body: "Follows, subs, Bits, raids, redemptions, polls, predictions, goals, charity, ads, chat, and more through one relay token.",
    },
    {
      label: "YouTube only",
      title: "Live Chat without a custom poller",
      body: "Messages, Super Chats, Super Stickers, memberships, moderation events, and live-chat lifecycle events while your broadcast is active.",
    },
    {
      label: "Twitch + YouTube",
      title: "One socket for multi-platform streams",
      body: "Connect both accounts and receive normalized envelopes with raw provider payloads. Route by type or provider in your overlay, bot, or local agent.",
    },
  ];

  return (
    <section>
      <div className="mx-auto w-full max-w-3xl px-6 pb-16 sm:pb-20">
        <p className="font-mono text-xs tracking-wide text-neutral-500 uppercase">
          Pick your setup
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {modes.map((mode) => (
            <article key={mode.label} className="rounded-xl border border-neutral-200 bg-white p-4">
              <p className="font-mono text-xs tracking-wide text-violet-700 uppercase">{mode.label}</p>
              <h2 className="mt-3 text-base font-semibold tracking-tight text-neutral-950">
                {mode.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-neutral-600">{mode.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function LivePreview() {
  const events = [
    { type: "channel.cheer", user: "ryan", note: "100 bits", time: "12s" },
    { type: "youtube.live_chat.super_chat", user: "jules", note: '"keep building"', time: "18s" },
    { type: "channel.subscribe", user: "morgan", note: "tier 1", time: "24s" },
    { type: "channel.follow", user: "alex", note: "", time: "38s" },
    { type: "channel.chat.message", user: "ki", note: '"GG"', time: "1m" },
    { type: "channel.channel_points_custom_reward_redemption.add", user: "sam", note: "hydrate", time: "2m", muted: true },
  ];

  return (
    <section>
      <div className="mx-auto w-full max-w-3xl px-6 pb-16 sm:pb-20">
        <p className="font-mono text-xs tracking-wide text-neutral-500 uppercase">
          live preview
        </p>
        <p className="mt-3 max-w-[60ch] text-pretty text-sm text-neutral-600">
          A mixed sample over one relay token. Twitch and YouTube keep their raw provider payloads,
          with a shared envelope for routing.
        </p>
        <div className="mt-6 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm shadow-violet-200/40 ring-1 ring-black/5">
          <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-4 py-2 text-xs text-neutral-600">
            <div className="flex items-center gap-2">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-violet-500 opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-violet-600" />
              </span>
              <span className="font-mono">wss://signal.ryan.ceo/ws</span>
            </div>
            <span className="font-mono tracking-wide uppercase">connected</span>
          </div>
          <ul role="list" className="divide-y divide-neutral-200">
            {events.map((event) => (
              <li
                key={`${event.type}-${event.time}`}
                className={`grid grid-cols-[auto_1fr_auto] items-center gap-4 px-4 py-3 text-sm ${event.muted ? "text-neutral-500" : "text-neutral-900"}`}
              >
                <span className="font-mono text-xs text-violet-700">{event.type}</span>
                <span className="truncate">
                  <span className="font-medium">{event.user}</span>
                  {event.note ? (
                    <span className="text-neutral-500"> · {event.note}</span>
                  ) : null}
                </span>
                <span className="font-mono text-xs tabular-nums text-neutral-500">{event.time}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function CodeSection() {
  const code = `// npm install @signal-kit/client
import { SignalKit } from "@signal-kit/client";

const events = new SignalKit({
  url: "wss://signal.ryan.ceo/ws",
  token: process.env.SIGNAL_KIT_TOKEN!,
});

events.on("channel.cheer", ({ event }) => {
  overlay.bits({
    user: event.user_name,
    bits: event.bits,
    message: event.message,
  });
});

events.on("youtube.live_chat.super_chat", ({ event }) => {
  overlay.superChat({
    user: event.authorDetails?.displayName,
    message: event.snippet?.displayMessage,
  });
});

events.connect();`;

  return (
    <section>
      <div className="mx-auto w-full max-w-3xl px-6 pb-16 sm:pb-20">
        <p className="mb-3 font-mono text-xs tracking-wide text-neutral-500 uppercase">
          SDK
        </p>
        <CodeBlock filename="overlay.ts" code={code} lang="typescript" />
      </div>
    </section>
  );
}

function Prose() {
  return (
    <section>
      <div className="mx-auto w-full max-w-3xl px-6 pb-16 sm:pb-20">
        <h2 className="max-w-[32ch] text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
          What is Signal Kit?
        </h2>
        <div className="mt-5 max-w-[68ch] space-y-4 text-pretty text-neutral-700">
          <p>
            Signal Kit is a small piece of infrastructure between you and livestream provider APIs.
            Sign in with Twitch or YouTube, connect the other platform when you need it, and let the
            app manage provider tokens, EventSub sessions, and YouTube Live Chat polling.
          </p>
          <p>
            On the other side, you get a single relay WebSocket. Drop a token into an overlay, a
            local agent, or a hobby script. Notifications stream through with the raw{" "}
            <code className="rounded bg-violet-50 px-1 py-0.5 font-mono text-sm text-violet-800">event</code>{" "}
            payload each provider sent. No vendor JSON shapes, no alert templates.
          </p>
          <p>
            It is self-hostable, runs in Docker, and stores credentials encrypted in MySQL. There is
            no UI generator and no overlay marketplace. You build the layer above.
          </p>
        </div>
      </div>
    </section>
  );
}

function Faq() {
  const items = [
    {
      q: "Do I need both Twitch and YouTube?",
      a: "No. You can use Twitch by itself, YouTube by itself, or connect both accounts to the same relay token.",
    },
    {
      q: "Are provider tokens exposed to overlays?",
      a: "No. Overlays connect with a relay token issued by the dashboard. Twitch and YouTube credentials never leave the server.",
    },
    {
      q: "Which events are supported?",
      a: "Every EventSub topic Twitch lets you subscribe to with the granted scopes, plus YouTube Live Chat messages and fan-funding chat events while a broadcast is active.",
    },
    {
      q: "Can I self-host?",
      a: "Yes. Docker image, docker-compose, .env, MySQL. The relay WebSocket and the Next.js app run in the same container.",
    },
  ];

  return (
    <section>
      <div className="mx-auto w-full max-w-3xl px-6 pb-16 sm:pb-20">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">FAQ</h2>
        <dl className="mt-6 divide-y divide-neutral-200 border-t border-neutral-200">
          {items.map((item) => (
            <div key={item.q} className="py-4">
              <dt className="text-base font-semibold tracking-tight">{item.q}</dt>
              <dd className="mt-1.5 max-w-[68ch] text-pretty text-neutral-600">{item.a}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function Outro() {
  return (
    <section>
      <div className="mx-auto w-full max-w-3xl px-6 pb-24">
        <h2 className="max-w-[28ch] text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
          Hook into the platforms you stream on.
        </h2>
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
          <a
            href="/api/auth/twitch/start"
            className="inline-flex items-center justify-center rounded-md bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-violet-600 hover:bg-violet-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600"
          >
            Continue with Twitch
          </a>
          <a
            href="/api/auth/youtube/start"
            className="inline-flex items-center justify-center rounded-md border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
          >
            Continue with YouTube
          </a>
          <Link
            href="/docs"
            className="text-sm font-semibold text-neutral-950 underline-offset-4 hover:underline"
          >
            Read the docs <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-neutral-200">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-mono text-xs tracking-wide text-neutral-500 uppercase">
          Signal Kit · An indie project
        </p>
        <nav className="flex items-center gap-6 text-sm text-neutral-600">
          <Link href="/docs" className="font-normal hover:text-neutral-950">
            Docs
          </Link>
          <Link href="/dashboard" className="font-normal hover:text-neutral-950">
            Dashboard
          </Link>
        </nav>
      </div>
    </footer>
  );
}
