import Link from "next/link";
import { CodeBlock } from "@/components/CodeBlock";
import { Logo } from "@/components/Logo";
import { EVENT_CATALOG } from "@/lib/twitch/event-catalog";

export default function DocsPage() {
  return (
    <>
      <DocsHeader />
      <main className="flex-1">
        <Intro />
        <Install />
        <QuickStart />
        <MessageShape />
        <Catalog />
      </main>
      <DocsFooter />
    </>
  );
}

function DocsHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-6">
        <Logo />
        <nav className="flex items-center gap-1 text-sm text-neutral-600">
          <Link href="/docs" className="rounded-md px-3 py-2 font-semibold text-neutral-950">
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

function Intro() {
  return (
    <section>
      <div className="mx-auto w-full max-w-3xl px-6 pt-16 pb-10 sm:pt-24">
        <p className="font-mono text-xs tracking-wide text-neutral-500 uppercase">
          Docs
        </p>
        <h1 className="mt-4 max-w-[28ch] text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Build with Twitch and YouTube Live events.
        </h1>
        <p className="mt-5 max-w-[60ch] text-pretty text-neutral-600">
          The relay exposes a single authenticated WebSocket. Messages are JSON. The{" "}
          <code className="rounded bg-violet-50 px-1 py-0.5 font-mono text-sm text-violet-800">
            event
          </code>{" "}
          field is the raw provider payload. Twitch messages use EventSub payloads. YouTube
          messages use Live Chat API resources.
        </p>
      </div>
    </section>
  );
}

function Install() {
  const npm = `npm install @signal-kit/client`;
  const script = `<script src="https://signal.ryan.ceo/twe-client.js"></script>`;

  return (
    <section>
      <div className="mx-auto w-full max-w-3xl px-6 pb-16 sm:pb-20">
        <p className="font-mono text-xs tracking-wide text-neutral-500 uppercase">
          Install
        </p>
        <h2 className="mt-3 max-w-[28ch] text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
          Two ways to load the SDK.
        </h2>
        <p className="mt-3 max-w-[60ch] text-pretty text-neutral-600">
          Use the npm package in Node, Bun, or any bundled project. Use the script tag for plain
          HTML overlays.
        </p>
        <div className="mt-6 grid gap-4">
          <CodeBlock filename="terminal" code={npm} lang="bash" />
          <CodeBlock filename="overlay.html" code={script} lang="html" />
        </div>
      </div>
    </section>
  );
}

function QuickStart() {
  const browser = `<script src="https://signal.ryan.ceo/twe-client.js"></script>
<script>
  const events = new SignalKit({
    url: "wss://signal.ryan.ceo/ws",
    token: "sk_live_...",
  });

  events.on("channel.cheer", ({ event }) => {
    document.body.dataset.bits = event.bits;
  });

  events.on("youtube.live_chat.super_chat", ({ event }) => {
    console.log(event.snippet.displayMessage);
  });

  events.connect();
</script>`;

  const node = `import { SignalKit } from "@signal-kit/client";

const events = new SignalKit({
  url: "wss://signal.ryan.ceo/ws",
  token: process.env.SIGNAL_KIT_TOKEN!,
});

events.on("*", (message) => {
  console.log(message.provider, message.type, message.event);
});

events.connect();`;

  return (
    <section>
      <div className="mx-auto w-full max-w-3xl px-6 pb-16 sm:pb-20">
        <p className="font-mono text-xs tracking-wide text-neutral-500 uppercase">
          Quick start
        </p>
        <h2 className="mt-3 max-w-[28ch] text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
          Connect and subscribe.
        </h2>
        <p className="mt-3 max-w-[60ch] text-pretty text-neutral-600">
          Both clients expose the same API.{" "}
          <code className="rounded bg-violet-50 px-1 py-0.5 font-mono text-sm text-violet-800">
            on(type, handler)
          </code>{" "}
          subscribes to a specific provider event type, or pass{" "}
          <code className="rounded bg-violet-50 px-1 py-0.5 font-mono text-sm text-violet-800">
            &quot;*&quot;
          </code>{" "}
          to receive every message.
        </p>
        <div className="mt-6 grid gap-4">
          <div>
            <div className="mb-2 flex items-baseline justify-between font-mono text-xs tracking-wide text-neutral-500 uppercase">
              <span>Browser overlay</span>
              <span>vanilla JS</span>
            </div>
            <CodeBlock filename="overlay.html" code={browser} lang="html" />
          </div>
          <div>
            <div className="mb-2 flex items-baseline justify-between font-mono text-xs tracking-wide text-neutral-500 uppercase">
              <span>Node / Bun</span>
              <span>TypeScript</span>
            </div>
            <CodeBlock filename="bot.ts" code={node} lang="typescript" />
          </div>
        </div>
      </div>
    </section>
  );
}

function MessageShape() {
  const payload = `{
  "type": "youtube.live_chat.message",
  "provider": "youtube",
  "account": {
    "provider": "youtube",
    "displayName": "Creator"
  },
  "subscription": {
    "type": "youtube.live_chat",
    "liveChatId": "...",
    "broadcastId": "..."
  },
  "event": {
    "id": "...",
    "snippet": {
      "type": "textMessageEvent",
      "displayMessage": "hello chat"
    },
    "authorDetails": {
      "displayName": "viewer"
    }
  },
  "receivedAt": "2026-05-15T00:00:00.000Z"
}`;

  return (
    <section>
      <div className="mx-auto w-full max-w-3xl px-6 pb-16 sm:pb-20">
        <p className="font-mono text-xs tracking-wide text-neutral-500 uppercase">
          Message shape
        </p>
        <h2 className="mt-3 max-w-[28ch] text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
          One envelope, one event.
        </h2>
        <p className="mt-3 max-w-[60ch] text-pretty text-neutral-600">
          The relay keeps provider payloads raw. The{" "}
          <code className="rounded bg-violet-50 px-1 py-0.5 font-mono text-sm text-violet-800">
            event
          </code>{" "}
          field is exactly what Twitch or YouTube sends. Use{" "}
          <code className="rounded bg-violet-50 px-1 py-0.5 font-mono text-sm text-violet-800">
            type
          </code>{" "}
          to route, ignore everything you don&apos;t care about.
        </p>
        <div className="mt-6">
          <CodeBlock filename="message.json" code={payload} lang="json" />
        </div>
      </div>
    </section>
  );
}

function Catalog() {
  return (
    <section>
      <div className="mx-auto w-full max-w-3xl px-6 pb-24">
        <p className="font-mono text-xs tracking-wide text-neutral-500 uppercase">
          Event catalog
        </p>
        <h2 className="mt-3 max-w-[28ch] text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
          Twitch EventSub catalog.
        </h2>
        <p className="mt-3 max-w-[60ch] text-pretty text-neutral-600">
          Subscriptions are created when the granted Twitch scopes cover them. The dashboard shows
          which events are ready and which need a scope. YouTube Live Chat events are discovered
          automatically from active broadcasts after connecting YouTube.
        </p>
        <div className="mt-6 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
          <p className="font-mono text-xs tracking-wide text-neutral-500 uppercase">
            YouTube live event types
          </p>
          <p className="mt-2 text-sm text-neutral-600">
            The live poller emits events like{" "}
            <code className="rounded bg-white px-1 py-0.5 font-mono text-xs text-violet-800">
              youtube.live_chat.message
            </code>
            ,{" "}
            <code className="rounded bg-white px-1 py-0.5 font-mono text-xs text-violet-800">
              youtube.live_chat.super_chat
            </code>
            , and{" "}
            <code className="rounded bg-white px-1 py-0.5 font-mono text-xs text-violet-800">
              youtube.live_chat.super_sticker
            </code>
            . Use{" "}
            <code className="rounded bg-white px-1 py-0.5 font-mono text-xs text-violet-800">
              message.provider
            </code>{" "}
            to separate Twitch from YouTube in shared relay streams.
          </p>
        </div>
        <dl className="mt-8 divide-y divide-neutral-200 border-t border-neutral-200">
          {EVENT_CATALOG.map((item) => (
            <div key={`${item.type}-${item.version}`} className="py-4">
              <dt className="flex items-baseline justify-between gap-4">
                <span className="text-base font-semibold tracking-tight">{item.label}</span>
                <span className="font-mono text-xs text-neutral-500">v{item.version}</span>
              </dt>
              <dd className="mt-1">
                <p className="font-mono text-xs text-violet-700">{item.type}</p>
                <p className="mt-1.5 max-w-[68ch] text-pretty text-neutral-600">
                  {item.description}
                </p>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function DocsFooter() {
  return (
    <footer className="border-t border-neutral-200">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-mono text-xs tracking-wide text-neutral-500 uppercase">
          Signal Kit · An indie project
        </p>
        <nav className="flex items-center gap-6 text-sm text-neutral-600">
          <Link href="/" className="font-normal hover:text-neutral-950">
            Home
          </Link>
          <Link href="/dashboard" className="font-normal hover:text-neutral-950">
            Dashboard
          </Link>
        </nav>
      </div>
    </footer>
  );
}

