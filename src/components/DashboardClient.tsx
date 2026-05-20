"use client";

import { useState } from "react";

type TokenRow = {
  id: string;
  label: string;
  createdAt: Date | string;
  lastUsedAt: Date | string | null;
  revokedAt: Date | string | null;
};

type ConnectedAccount = {
  id: string;
  provider: string;
  providerAccountId: string;
  login: string;
  displayName: string;
  profileImageUrl: string | null;
  scopes: string[];
  lastSyncAt: Date | string | null;
  lastEventAt: Date | string | null;
  lastError: string | null;
  connectedAt: Date | string | null;
};

type DashboardEventStatus =
  | "enabled"
  | "desired"
  | "failed"
  | "revoked"
  | "pending"
  | "scope";

type DashboardEvent = {
  type: string;
  version: string;
  label: string;
  description: string;
  requiredScopes: string[];
  enabledByScopes: boolean;
  status: DashboardEventStatus;
  error: string | null;
};

type Snippets = {
  npmInstall: string;
  scriptTag: string;
  browserExample: string;
  nodeExample: string;
};

type Highlighted = {
  npmInstall: string;
  scriptTag: string;
  browserExample: string;
  nodeExample: string;
};

export function DashboardClient({
  initialTokens,
  accounts,
  hasTwitch,
  events,
  wsUrl,
  appUrl,
  snippets,
  highlighted,
}: {
  initialTokens: TokenRow[];
  accounts: ConnectedAccount[];
  hasTwitch: boolean;
  events: DashboardEvent[];
  wsUrl: string;
  appUrl: string;
  snippets: Snippets;
  highlighted: Highlighted;
}) {
  const [tokens, setTokens] = useState(initialTokens);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function createToken() {
    setStatus("Creating token...");
    const response = await fetch("/api/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: `Overlay ${tokens.length + 1}` }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setStatus(payload.error ?? "Token creation failed.");
      return;
    }
    setNewToken(payload.token);
    const refreshed = await fetch("/api/tokens").then((res) => res.json());
    setTokens(refreshed.tokens);
    setStatus("Token created. Copy it now — it is only shown once.");
  }

  async function revokeToken(id: string) {
    await fetch(`/api/tokens/${id}`, { method: "DELETE" });
    const refreshed = await fetch("/api/tokens").then((res) => res.json());
    setTokens(refreshed.tokens);
  }

  async function syncSubscriptions() {
    setStatus("Syncing desired EventSub subscriptions...");
    const response = await fetch("/api/event-subscriptions/sync", { method: "POST" });
    const payload = await response.json();
    setStatus(
      response.ok
        ? `Desired: ${payload.desired} · skipped for scopes: ${payload.skippedForScopes}${payload.removed ? ` · cleaned up ${payload.removed} stale row${payload.removed === 1 ? "" : "s"}` : ""}.`
        : (payload.error ?? "Sync failed."),
    );
  }

  return (
    <>
      {status ? (
        <div className="border-b border-neutral-200 bg-neutral-50">
          <div className="mx-auto w-full max-w-6xl px-6 py-3 font-mono text-xs text-neutral-700">
            {status}
          </div>
        </div>
      ) : null}

      <Accounts accounts={accounts} hasTwitch={hasTwitch} />
      <Tokens
        tokens={tokens}
        newToken={newToken}
        wsUrl={wsUrl}
        appUrl={appUrl}
        snippets={snippets}
        highlighted={highlighted}
        onCreate={createToken}
        onRevoke={revokeToken}
      />
      <Events events={events} onSync={syncSubscriptions} />
    </>
  );
}

function Accounts({ accounts, hasTwitch }: { accounts: ConnectedAccount[]; hasTwitch: boolean }) {
  return (
    <section className="border-b border-neutral-200">
      <div className="mx-auto w-full max-w-6xl px-6 pt-12 pb-16">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-xs tracking-wide text-neutral-500 uppercase">
              Connected accounts
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
              Twitch plus YouTube Live
            </h2>
            <p className="mt-2 max-w-[62ch] text-pretty text-neutral-600">
              YouTube support watches active live broadcasts and relays live chat events through
              the same WebSocket tokens as Twitch.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {!hasTwitch ? (
              <a
                href="/api/auth/twitch/start"
                className="inline-flex items-center rounded-md bg-violet-600 px-3 py-2 text-sm font-semibold text-white ring-1 ring-violet-600 hover:bg-violet-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600"
              >
                Connect Twitch
              </a>
            ) : null}
            <a
              href="/api/auth/youtube/start"
              className="inline-flex items-center rounded-md bg-neutral-950 px-3 py-2 text-sm font-semibold text-white ring-1 ring-neutral-950 hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
            >
              Connect YouTube
            </a>
          </div>
        </div>

        <ul role="list" className="mt-8 divide-y divide-neutral-200 border-t border-neutral-200">
          {accounts.map((account) => (
            <li
              key={`${account.provider}-${account.id}`}
              className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-center gap-3">
                {account.profileImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={account.profileImageUrl}
                    alt=""
                    className="size-10 rounded-full bg-neutral-100 object-cover"
                  />
                ) : (
                  <div className="flex size-10 items-center justify-center rounded-full bg-neutral-100 font-mono text-xs text-neutral-500 uppercase">
                    {account.provider.slice(0, 2)}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="truncate text-sm font-semibold tracking-tight">
                      {account.displayName}
                    </span>
                    <span className="font-mono text-xs text-neutral-500 uppercase">
                      {account.provider}
                    </span>
                  </div>
                  <div className="mt-1 truncate font-mono text-xs text-neutral-500">
                    {account.provider === "youtube" ? "live chat relay" : "eventsub relay"} · {account.scopes.length} scopes
                  </div>
                  {account.lastError ? (
                    <div className="mt-2 max-w-[72ch] truncate font-mono text-xs text-red-700" title={account.lastError}>
                      {account.lastError}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="font-mono text-xs text-neutral-500 sm:text-right">
                {account.provider === "youtube" ? (
                  <>
                    <div>
                      last sync {account.lastSyncAt ? new Date(account.lastSyncAt).toLocaleString() : "pending"}
                    </div>
                    <div>
                      last event {account.lastEventAt ? new Date(account.lastEventAt).toLocaleString() : "none yet"}
                    </div>
                  </>
                ) : (
                  <div>connected owner</div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Tokens({
  tokens,
  newToken,
  wsUrl,
  appUrl,
  snippets,
  highlighted,
  onCreate,
  onRevoke,
}: {
  tokens: TokenRow[];
  newToken: string | null;
  wsUrl: string;
  appUrl: string;
  snippets: Snippets;
  highlighted: Highlighted;
  onCreate: () => void;
  onRevoke: (id: string) => void;
}) {
  return (
    <section className="border-b border-neutral-200">
      <div className="mx-auto w-full max-w-6xl px-6 pt-12 pb-16">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-xs tracking-wide text-neutral-500 uppercase">
              Relay tokens
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
              Tokens for overlays and bots
            </h2>
            <p className="mt-2 max-w-[60ch] text-pretty text-neutral-600">
              Pass a token in the WebSocket URL. Tokens are shown once and can be revoked any time.
            </p>
          </div>
          <button
            type="button"
            onClick={onCreate}
            className="inline-flex items-center rounded-md bg-violet-600 px-3 py-2 text-sm font-semibold text-white ring-1 ring-violet-600 hover:bg-violet-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600"
          >
            Generate token
          </button>
        </div>

        {newToken ? <NewTokenReveal token={newToken} /> : null}

        <div className="mt-8">
          {tokens.length === 0 ? (
            <p className="border-t border-neutral-200 pt-6 text-sm text-neutral-500">
              No tokens yet. Generate one to start connecting overlays.
            </p>
          ) : (
            <ul role="list" className="divide-y divide-neutral-200 border-t border-neutral-200">
              {tokens.map((token) => (
                <li
                  key={token.id}
                  className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="text-sm font-semibold tracking-tight">{token.label}</div>
                    <div className="mt-1 font-mono text-xs text-neutral-500">
                      {token.revokedAt ? "revoked" : "active"} · last used{" "}
                      {token.lastUsedAt
                        ? new Date(token.lastUsedAt).toLocaleString()
                        : "never"}
                    </div>
                  </div>
                  {!token.revokedAt ? (
                    <button
                      type="button"
                      onClick={() => onRevoke(token.id)}
                      className="inline-flex items-center rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
                    >
                      Revoke
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        <UseTheToken
          wsUrl={wsUrl}
          appUrl={appUrl}
          newToken={newToken}
          snippets={snippets}
          highlighted={highlighted}
        />
      </div>
    </section>
  );
}

function NewTokenReveal({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-8 overflow-hidden rounded-xl border border-violet-200 bg-violet-50">
      <div className="flex items-center justify-between border-b border-violet-200 bg-white px-4 py-2.5 font-mono text-xs tracking-wide text-violet-700 uppercase">
        <span>new token</span>
        <span>shown once</span>
      </div>
      <div className="flex items-center gap-3 p-4">
        <pre className="flex-1 overflow-x-auto font-mono text-sm text-violet-900">
          <code className="break-all">{token}</code>
        </pre>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(token);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="inline-flex shrink-0 items-center rounded-md border border-violet-300 bg-white px-3 py-1.5 text-xs font-semibold text-violet-800 hover:bg-violet-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

function UseTheToken({
  wsUrl,
  appUrl,
  newToken,
  snippets,
  highlighted,
}: {
  wsUrl: string;
  appUrl: string;
  newToken: string | null;
  snippets: Snippets;
  highlighted: Highlighted;
}) {
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  const tokenForPrompt = newToken ?? "<paste-your-relay-token-here>";
  const prompt = buildAiPrompt({ wsUrl, appUrl, token: tokenForPrompt });

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    } catch {
      setCopiedPrompt(false);
    }
  }

  return (
    <div className="mt-12 border-t border-neutral-200 pt-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-xs tracking-wide text-neutral-500 uppercase">
            Use the token
          </p>
          <h3 className="mt-3 text-xl font-semibold tracking-tight sm:text-2xl">
            Install and connect
          </h3>
          <p className="mt-2 max-w-[60ch] text-pretty text-neutral-600">
            The{" "}
            <code className="rounded bg-violet-50 px-1 py-0.5 font-mono text-sm text-violet-800">
              @signal-kit/client
            </code>{" "}
            package is published on npm. Drop it into any JavaScript project.
          </p>
        </div>
        <button
          type="button"
          onClick={copyPrompt}
          className="inline-flex items-center gap-2 rounded-md border border-violet-300 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-800 hover:bg-violet-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600"
        >
          {copiedPrompt ? "Copied to clipboard" : "Copy AI agent prompt"}
        </button>
      </div>

      <div className="mt-6 grid gap-6">
        <div>
          <p className="mb-2 font-mono text-xs tracking-wide text-neutral-500 uppercase">
            Install
          </p>
          <TabbedCode
            tabs={[
              {
                key: "npm",
                label: "npm",
                html: highlighted.npmInstall,
                fallback: snippets.npmInstall,
              },
              {
                key: "browser",
                label: "script tag",
                html: highlighted.scriptTag,
                fallback: snippets.scriptTag,
              },
            ]}
          />
        </div>

        <div>
          <p className="mb-2 font-mono text-xs tracking-wide text-neutral-500 uppercase">
            Quick start
          </p>
          <TabbedCode
            tabs={[
              {
                key: "node",
                label: "Node / Bun",
                html: highlighted.nodeExample,
                fallback: snippets.nodeExample,
              },
              {
                key: "browser",
                label: "Browser",
                html: highlighted.browserExample,
                fallback: snippets.browserExample,
              },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

type CodeTab = {
  key: string;
  label: string;
  html: string;
  fallback: string;
};

function TabbedCode({ tabs }: { tabs: CodeTab[] }) {
  const [activeKey, setActiveKey] = useState(tabs[0]?.key);
  const active = tabs.find((tab) => tab.key === activeKey) ?? tabs[0];
  if (!active) {
    return null;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-neutral-950 font-mono text-sm text-neutral-100 shadow-sm shadow-violet-200/40 ring-1 ring-black/5">
      <div
        role="tablist"
        aria-label="Code variants"
        className="flex items-center gap-1 border-b border-neutral-800 px-2 py-1.5"
      >
        {tabs.map((tab) => {
          const isActive = tab.key === active.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveKey(tab.key)}
              className={
                isActive
                  ? "rounded-md bg-neutral-800 px-3 py-1 text-xs font-semibold tracking-wide text-white uppercase"
                  : "rounded-md px-3 py-1 text-xs font-semibold tracking-wide text-neutral-400 uppercase hover:text-neutral-100"
              }
            >
              {tab.label}
            </button>
          );
        })}
        <span aria-hidden="true" className="ml-auto pr-2 text-neutral-500">
          •••
        </span>
      </div>
      {active.html ? (
        <div
          className="overflow-x-auto p-5 text-sm leading-6 [&_pre]:m-0 [&_pre]:bg-transparent! [&_pre]:p-0"
          dangerouslySetInnerHTML={{ __html: active.html }}
        />
      ) : (
        <pre className="overflow-x-auto p-5 leading-6 text-neutral-200">
          <code>{active.fallback}</code>
        </pre>
      )}
    </div>
  );
}

function buildAiPrompt({
  wsUrl,
  appUrl,
  token,
}: {
  wsUrl: string;
  appUrl: string;
  token: string;
}) {
  return `Integrate the @signal-kit/client SDK into this project. Signal Kit (${appUrl}) is a Twitch EventSub and YouTube Live Chat WebSocket relay.

Setup:
1. Install: \`npm install @signal-kit/client\`
2. Add to .env (do not commit):
   SIGNAL_KIT_URL=${wsUrl}
   SIGNAL_KIT_TOKEN=${token}

Usage example:
\`\`\`ts
import { SignalKit } from "@signal-kit/client";

const events = new SignalKit({
  url: process.env.SIGNAL_KIT_URL!,
  token: process.env.SIGNAL_KIT_TOKEN!,
});

events.on("channel.cheer", ({ event }) => {
  // event.user_name, event.bits, event.message
});

events.on("youtube.live_chat.message", ({ event }) => {
  // event.authorDetails?.displayName, event.snippet?.displayMessage
});

events.on("*", (message) => {
  console.log(message.provider, message.type, message.event);
});

events.connect();
\`\`\`

Notes:
- The client auto-reconnects on connection drops.
- Event payloads are raw provider JSON. Twitch events are EventSub payloads; YouTube events are liveChatMessage resources.
- Use the "*" handler to receive every event.
- Reference docs: ${appUrl}/docs
- Never commit SIGNAL_KIT_TOKEN to source control.

Now ask me what I want to do with these events before writing any code.`;
}

function Events({
  events,
  onSync,
}: {
  events: DashboardEvent[];
  onSync: () => void;
}) {
  const counts = events.reduce(
    (acc, event) => {
      acc[event.status] = (acc[event.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<DashboardEventStatus, number>,
  );

  return (
    <section>
      <div className="mx-auto w-full max-w-6xl px-6 pt-12 pb-24">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-xs tracking-wide text-neutral-500 uppercase">
              Subscriptions
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
              EventSub state
            </h2>
            <p className="mt-2 max-w-[60ch] text-pretty text-neutral-600">
              Every event Signal Kit can subscribe to for this channel, plus its current state on
              the Twitch session.
            </p>
          </div>
          <button
            type="button"
            onClick={onSync}
            className="inline-flex items-center rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
          >
            Sync subscriptions
          </button>
        </div>

        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 font-mono text-xs text-neutral-600">
          <Tally label="enabled" count={counts.enabled ?? 0} tone="emerald" />
          <Tally label="pending" count={counts.pending ?? 0} tone="neutral" />
          <Tally label="desired" count={counts.desired ?? 0} tone="violet" />
          <Tally label="failed" count={counts.failed ?? 0} tone="red" />
          <Tally label="revoked" count={counts.revoked ?? 0} tone="neutral" />
          <Tally label="scope" count={counts.scope ?? 0} tone="amber" />
        </div>

        <div className="mt-6 overflow-hidden rounded-lg border border-neutral-200">
          <div className="hidden grid-cols-[minmax(0,1fr)_auto] items-center gap-6 border-b border-neutral-200 bg-neutral-50 px-5 py-2 font-mono text-xs tracking-wide text-neutral-500 uppercase sm:grid">
            <span>event</span>
            <span>status</span>
          </div>
          <ul role="list" className="divide-y divide-neutral-200">
            {events.map((event) => (
              <li
                key={`${event.type}-${event.version}`}
                className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6"
              >
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold tracking-tight text-neutral-950">
                      {event.label}
                    </span>
                    <span className="font-mono text-xs text-neutral-500">v{event.version}</span>
                  </div>
                  <div className="mt-1 truncate font-mono text-xs text-neutral-500">
                    {event.type}
                  </div>
                  {event.status === "scope" && event.requiredScopes.length > 0 ? (
                    <div className="mt-2 font-mono text-xs text-amber-700">
                      needs {event.requiredScopes.join(", ")}
                    </div>
                  ) : null}
                  {event.error ? (
                    <div className="mt-2 truncate font-mono text-xs text-red-700" title={event.error}>
                      {event.error}
                    </div>
                  ) : null}
                </div>
                <StatusPill status={event.status} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Tally({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: "emerald" | "neutral" | "violet" | "red" | "amber";
}) {
  const toneClass = {
    emerald: "bg-emerald-500",
    neutral: "bg-neutral-400",
    violet: "bg-violet-500",
    red: "bg-red-500",
    amber: "bg-amber-500",
  }[tone];
  return (
    <span className="inline-flex items-center gap-2 tracking-wide uppercase">
      <span className={`size-1.5 rounded-full ${toneClass}`} aria-hidden="true" />
      {label}
      <span className="tabular-nums text-neutral-900">{count}</span>
    </span>
  );
}

function StatusPill({ status }: { status: DashboardEventStatus }) {
  const tone = {
    enabled: "text-emerald-700",
    pending: "text-neutral-600",
    desired: "text-violet-700",
    failed: "text-red-700",
    revoked: "text-neutral-500",
    scope: "text-amber-700",
  }[status];
  return (
    <span className={`font-mono text-xs tracking-wide uppercase ${tone}`}>{status}</span>
  );
}
