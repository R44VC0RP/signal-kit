import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { CopyIconButton } from "@/components/home/CopyIconButton";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";

export const metadata: Metadata = {
  title: "Docs · Signal Kit",
  description: "Connect to Signal Kit with the SDK or a plain WebSocket, and handle Twitch, YouTube and X events in one format.",
};

const SECTIONS = [
  ["quick-start", "Quick start"],
  ["events", "Event format"],
  ["kinds", "Event kinds"],
  ["replay", "Reconnects and replay"],
  ["websocket", "Plain WebSocket"],
  ["cli", "CLI"],
  ["limits", "Limits"],
] as const;

const QUICK_START = `import { SignalKit } from "@signal-kit/client";

const kit = new SignalKit({ token: process.env.SIGNAL_KIT_KEY });

kit.on("tip", (e) => console.log(\`\${e.actor?.name} sent \${e.amount?.display}\`));
kit.on("chat.message", (e) => console.log(e.actor?.name, e.message));

kit.connect();`;

const EVENT_SHAPE = `{
  "v": 2,
  "id": "01M4V160WEEDSY6AG1YG3PZRPQ",
  "kind": "tip",
  "platform": "youtube",
  "channel": { "connectionId": "…", "id": "UCSaecrr1v6dBCDJg5YD6FiA", "name": "vogel" },
  "actor": { "id": "UC…", "name": "mira.codes", "badges": ["member"] },
  "message": "Take my money.",
  "amount": { "value": 20, "currency": "USD", "display": "$20.00" },
  "data": { "source": "super_chat", "tier": 2 },
  "occurredAt": "2026-10-13T20:41:07.000Z",
  "receivedAt": "2026-10-13T20:41:07.412Z",
  "raw": { "type": "youtube.live_chat.superChatEvent", "event": { … } }
}`;

const PLAIN_WS = `const ws = new WebSocket("wss://signal.ryan.ceo/ws");

ws.onopen = () => {
  // Within 5 seconds. "since" is optional: the last event id you processed.
  ws.send(JSON.stringify({ type: "auth", token: "sk_live_…", since: lastId }));
};

ws.onmessage = ({ data }) => {
  const message = JSON.parse(data);
  if (message.type === "signal_kit.ready") return;     // authenticated
  if (message.type === "signal_kit.replayed") return;  // { count, truncated, lastId }
  lastId = message.id;                                  // a SignalKitEvent
  handle(message);
};`;

const CLI = `npm install -g @signal-kit/cli

SIGNALKIT_TOKEN=sk_live_… signal-kit
signal-kit --types tip,chat.message   # filter by kind or raw platform type
signal-kit --json                     # one event per line`;

const FIELDS: [string, string][] = [
  ["id", "Unique, time-sortable id. Pass the last one you handled as since to resume."],
  ["kind", "What happened, the same on every platform (see Event kinds)."],
  ["platform", "twitch, youtube or x."],
  ["channel", "Which of your connected channels it came from: connectionId, platform id, name."],
  ["actor", "Who did it, when there is someone: id, name, login, avatarUrl, badges."],
  ["message", "What they wrote, or null."],
  ["amount", "Money and Bits, always as value, currency and display. Null when nothing was paid."],
  ["data", "Kind-specific details, such as tier, months, viewers, reward or phase."],
  ["occurredAt", "When it happened on the platform. receivedAt is when Signal Kit got it."],
  ["raw", "The platform's original type and payload, untouched."],
];

const KINDS: [string, string, string][] = [
  ["chat.message", "A chat message", "Twitch, YouTube"],
  ["chat.message.deleted", "A chat message was removed", "YouTube"],
  ["chat.notification", "Chat notices such as announcements and resubs", "Twitch"],
  ["chat.settings", "Slow mode, followers-only and similar changed", "Twitch"],
  ["follow", "Someone followed", "Twitch"],
  ["subscription", "New sub, resub, membership, milestone or received gift", "Twitch, YouTube"],
  ["subscription.gift", "Someone gifted subs or memberships (data.count)", "Twitch, YouTube"],
  ["subscription.end", "A subscription ended", "Twitch"],
  ["tip", "Bits, Super Chats, Super Stickers, gifts and charity donations, with amount", "Twitch, YouTube"],
  ["raid", "An incoming or outgoing raid (data.viewers)", "Twitch"],
  ["redemption", "A channel points reward was redeemed or updated", "Twitch"],
  ["hype_train", "Hype train begin, progress and end (data.phase)", "Twitch"],
  ["poll", "Poll begin, progress and end", "Twitch, YouTube"],
  ["prediction", "Prediction begin, progress, lock and end", "Twitch"],
  ["goal", "Creator goal begin, progress and end", "Twitch"],
  ["charity", "Charity campaign start, progress and stop", "Twitch"],
  ["shoutout", "A shoutout was sent or received", "Twitch"],
  ["ad_break", "An ad break started", "Twitch"],
  ["moderation", "A user was banned or timed out", "YouTube"],
  ["stream.online", "The stream went live", "Twitch"],
  ["stream.offline", "The stream or chat ended", "Twitch, YouTube"],
  ["stream.update", "Title, category or language changed", "Twitch"],
  ["other", "Anything not mapped yet; check raw.type", "All"],
];

const LIMITS: [string, string][] = [
  ["Event history", "24 hours. A replay sends at most 1,000 events; if more were missed, signal_kit.replayed has truncated: true."],
  ["Authentication", "Send the auth message within 5 seconds of connecting. Messages to the server are capped at 64 KB."],
  ["Slow clients", "A client more than 4 MB behind is disconnected (code 1013) and can reconnect with since."],
  ["Close codes", "1008 means the key is invalid or revoked; the SDK does not reconnect after it. Other codes reconnect with backoff."],
  ["Keys", "Every key sees events from all of your connected channels. Revoking a key in the dashboard disconnects its clients immediately."],
];

export default function DocsPage() {
  return (
    <div className="sk-app flex flex-1 justify-center px-5 sm:px-8">
      <div className="flex w-full max-w-4xl flex-col">
        <SiteHeader>
          <Link href="/docs" className="text-[13px] text-(--text) transition-colors">
            Docs
          </Link>
        </SiteHeader>

        <main className="flex flex-col">
          <section className="flex flex-col gap-4 pt-12 sm:pt-20">
            <h1 className="sk-brand text-[36px] leading-10 font-semibold tracking-[-0.03em] text-(--text) sm:text-[44px] sm:leading-12">Docs</h1>
            <p className="max-w-145 text-base leading-[25px] text-pretty text-(--text-2)">
              Connect once and receive every event from your Twitch and YouTube channels in one format. X arrives once X enables livestream
              access.
            </p>
            <nav className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-(--text-3)">
              {SECTIONS.map(([id, label]) => (
                <a key={id} href={`#${id}`} className="transition-colors hover:text-(--text)">
                  {label}
                </a>
              ))}
            </nav>
          </section>

          <Doc id="quick-start" title="Quick start">
            <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-[15px] leading-6 text-(--text-2) marker:text-(--text-3)">
              <li>
                <Link href="/sign-in" className="text-(--accent-text) underline underline-offset-2">
                  Sign in
                </Link>{" "}
                with Twitch, YouTube or X, and connect your channels under Connections.
              </li>
              <li>Create a key under API keys.</li>
              <li>
                Install the SDK with <Code>npm install @signal-kit/client</Code> and connect. It works in browsers, Bun, Deno and Node 22+.
              </li>
            </ol>
            <Snippet name="index.ts" code={QUICK_START} />
            <p className="text-sm leading-[22px] text-(--text-3)">
              <Code>kit.on()</Code> takes a kind like <Code>&quot;tip&quot;</Code>, a raw platform type like{" "}
              <Code>&quot;channel.cheer&quot;</Code>, or <Code>&quot;*&quot;</Code> for everything, and returns an unsubscribe function. Keep
              keys on a server or in overlays you run yourself: anyone with a key receives your events.
            </p>
          </Doc>

          <Doc id="events" title="Event format">
            <p className="text-[15px] leading-6 text-(--text-2)">
              Every event has the same shape, whatever the platform. A Twitch cheer and a YouTube Super Chat are both a <Code>tip</Code>{" "}
              with an <Code>amount</Code>, so one handler covers both.
            </p>
            <Snippet name="SignalKitEvent" code={EVENT_SHAPE} />
            <Rows rows={FIELDS} mono />
            <p className="text-sm leading-[22px] text-(--text-3)">
              Types ship with the SDK: <Code>import type {"{ SignalKitEvent, EventKind }"} from &quot;@signal-kit/client&quot;</Code>.
            </p>
          </Doc>

          <Doc id="kinds" title="Event kinds">
            <div className="flex flex-col border-b border-(--line)">
              {KINDS.map(([kind, description, platforms]) => (
                <div key={kind} className="flex flex-col gap-1 border-t border-(--line) py-3 sm:flex-row sm:items-baseline sm:gap-6">
                  <span className="sk-mono text-xs leading-5 text-(--text) sm:w-48 sm:shrink-0">{kind}</span>
                  <span className="text-sm leading-[22px] text-(--text-2) sm:flex-1">{description}</span>
                  <span className="text-[13px] leading-5 text-(--text-3) sm:w-32 sm:shrink-0 sm:text-right">{platforms}</span>
                </div>
              ))}
            </div>
          </Doc>

          <Doc id="replay" title="Reconnects and replay">
            <p className="text-[15px] leading-6 text-(--text-2)">
              Events are kept for 24 hours. The SDK remembers the last event id and, after a dropped connection, asks for everything it
              missed before live events resume. Each event is delivered once. To resume across restarts, store{" "}
              <Code>kit.lastEventId</Code> and pass it back as <Code>since</Code>:
            </p>
            <Snippet name="resume.ts" code={`const kit = new SignalKit({ token, since: await load("lastEventId") });\nkit.on("*", async (e) => { await handle(e); await save("lastEventId", e.id); });`} />
          </Doc>

          <Doc id="websocket" title="Plain WebSocket">
            <p className="text-[15px] leading-6 text-(--text-2)">
              Without the SDK, connect to <Code>wss://signal.ryan.ceo/ws</Code> and send your key as the first message, so it stays out of
              URLs and logs. The server answers <Code>signal_kit.ready</Code>, replays anything after <Code>since</Code>, then sends events
              as they happen.
            </p>
            <Snippet name="socket.js" code={PLAIN_WS} />
          </Doc>

          <Doc id="cli" title="CLI">
            <p className="text-[15px] leading-6 text-(--text-2)">Watch your events in a terminal while you build.</p>
            <Snippet name="terminal" code={CLI} />
          </Doc>

          <Doc id="limits" title="Limits">
            <Rows rows={LIMITS} />
          </Doc>
        </main>

        <SiteFooter />
      </div>
    </div>
  );
}

function Doc({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="mt-16 flex scroll-mt-6 flex-col gap-5 sm:mt-20">
      <h2 className="sk-brand text-2xl leading-[30px] font-semibold tracking-[-0.02em] text-(--text)">{title}</h2>
      {children}
    </section>
  );
}

function Snippet({ name, code }: { name: string; code: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-(--line) bg-(--surface-inset)">
      <div className="flex h-10 items-center justify-between border-b border-(--line) px-5">
        <span className="sk-mono text-[11px] leading-3.5 text-(--text-2)">{name}</span>
        <CopyIconButton value={code} label={`Copy ${name}`} />
      </div>
      <pre className="sk-mono overflow-x-auto px-5 py-4 text-[11px] leading-[22px] text-(--text-2) sm:text-xs">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function Rows({ rows, mono = false }: { rows: [string, string][]; mono?: boolean }) {
  return (
    <div className="flex flex-col border-b border-(--line)">
      {rows.map(([label, description]) => (
        <div key={label} className="flex flex-col gap-1 border-t border-(--line) py-3 sm:flex-row sm:items-baseline sm:gap-6">
          <span className={`sm:w-48 sm:shrink-0 ${mono ? "sk-mono text-xs leading-5 text-(--text)" : "text-sm leading-[22px] font-medium text-(--text)"}`}>
            {label}
          </span>
          <span className="text-sm leading-[22px] text-pretty text-(--text-2)">{description}</span>
        </div>
      ))}
    </div>
  );
}

function Code({ children }: { children: ReactNode }) {
  return <code className="sk-mono rounded-sm bg-(--surface-panel) px-1 py-0.5 text-[0.85em] text-(--text)">{children}</code>;
}
