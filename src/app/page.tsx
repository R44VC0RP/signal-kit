import Link from "next/link";
import { CodeBlock } from "@/components/CodeBlock";
import { Logo } from "@/components/Logo";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <Hero />
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
          Twitch events as one developer-friendly WebSocket.
        </h1>
        <p className="mt-5 max-w-[60ch] text-pretty text-neutral-600">
          Sign in with Twitch, get a relay token, and pipe every follow, sub, cheer, redemption,
          raid, and chat event into overlays, agents, or anything else you build.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
          <a
            href="/api/auth/twitch/start"
            className="inline-flex items-center justify-center rounded-md bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-violet-600 hover:bg-violet-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600"
          >
            Continue with Twitch
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

function LivePreview() {
  const events = [
    { type: "channel.cheer", user: "ryan", note: "100 bits", time: "12s" },
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
          A sample of events streaming over a Signal Kit relay token. Same JSON Twitch sends,
          delivered through one WebSocket.
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
            Signal Kit is a small piece of infrastructure between you and Twitch EventSub. Sign in
            once and the app manages the EventSub WebSocket on your behalf, refreshes tokens, and
            resubscribes to topics whenever Twitch closes a session.
          </p>
          <p>
            On the other side, you get a single relay WebSocket. Drop a token into an overlay, a
            local agent, or a hobby script. Notifications stream through with the raw{" "}
            <code className="rounded bg-violet-50 px-1 py-0.5 font-mono text-sm text-violet-800">event</code>{" "}
            payload Twitch sent. No vendor JSON shapes, no alert templates.
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
      q: "Do I need to install anything on Twitch?",
      a: "No. You authorize the Signal Kit app via Twitch OAuth. The app then subscribes to EventSub topics for your channel using the WebSocket transport.",
    },
    {
      q: "Is my Twitch access token exposed to overlays?",
      a: "No. Overlays connect with a relay token issued by the dashboard. Twitch credentials never leave the server.",
    },
    {
      q: "Which events are supported?",
      a: "Every EventSub topic Twitch lets you subscribe to with the granted scopes. The dashboard shows what is ready and what needs a scope.",
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
          Hook into your stream the way you want.
        </h2>
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
          <a
            href="/api/auth/twitch/start"
            className="inline-flex items-center justify-center rounded-md bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-violet-600 hover:bg-violet-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600"
          >
            Continue with Twitch
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


