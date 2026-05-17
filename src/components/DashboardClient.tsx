"use client";

import { useState } from "react";

type TokenRow = {
  id: string;
  label: string;
  createdAt: Date | string;
  lastUsedAt: Date | string | null;
  revokedAt: Date | string | null;
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

export function DashboardClient({
  initialTokens,
  events,
  wsUrl,
  connectionHtml,
}: {
  initialTokens: TokenRow[];
  events: DashboardEvent[];
  wsUrl: string;
  connectionHtml: string;
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

      <Tokens
        tokens={tokens}
        newToken={newToken}
        wsUrl={wsUrl}
        connectionHtml={connectionHtml}
        onCreate={createToken}
        onRevoke={revokeToken}
      />
      <Events events={events} onSync={syncSubscriptions} />
    </>
  );
}

function Tokens({
  tokens,
  newToken,
  wsUrl,
  connectionHtml,
  onCreate,
  onRevoke,
}: {
  tokens: TokenRow[];
  newToken: string | null;
  wsUrl: string;
  connectionHtml: string;
  onCreate: () => void;
  onRevoke: (id: string) => void;
}) {
  return (
    <section className="border-b border-neutral-200">
      <div className="mx-auto w-full max-w-6xl px-6 pt-16 pb-16">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-xs tracking-wide text-neutral-500 uppercase">
              Relay tokens
            </p>
            <h2 className="mt-3 text-2xl font-medium tracking-tight sm:text-3xl">
              Tokens for overlays and bots
            </h2>
            <p className="mt-2 max-w-[60ch] text-pretty text-neutral-600">
              Pass a token in the WebSocket URL or{" "}
              <code className="rounded bg-neutral-100 px-1 py-0.5 font-mono text-sm text-neutral-900">
                Authorization
              </code>{" "}
              header. Tokens are shown once and can be revoked any time.
            </p>
          </div>
          <button
            type="button"
            onClick={onCreate}
            className="inline-flex items-center rounded-md bg-violet-600 px-3 py-2 text-sm font-medium text-white ring-1 ring-violet-600 hover:bg-violet-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600"
          >
            Generate token
          </button>
        </div>

        {newToken ? (
          <div className="mt-8 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-950 font-mono text-sm text-neutral-100">
            <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-2.5 text-xs tracking-wide text-neutral-400 uppercase">
              <span>new token</span>
              <span>shown once</span>
            </div>
            <pre className="overflow-x-auto p-5 text-neutral-200">
              <code className="break-all">{newToken}</code>
            </pre>
          </div>
        ) : null}

        <div className="mt-8 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-950 font-mono text-sm text-neutral-100">
          <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-2.5 text-xs tracking-wide text-neutral-400 uppercase">
            <span>connection</span>
            <span className="break-all text-neutral-500 normal-case">{wsUrl}?token=sk_live_...</span>
          </div>
          <div
            className="overflow-x-auto p-5 text-sm leading-6 [&_pre]:m-0 [&_pre]:bg-transparent! [&_pre]:p-0"
            dangerouslySetInnerHTML={{ __html: connectionHtml }}
          />
        </div>

        <div className="mt-10">
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
                    <div className="text-sm font-medium tracking-tight">{token.label}</div>
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
                      className="inline-flex items-center rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
                    >
                      Revoke
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
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
      <div className="mx-auto w-full max-w-6xl px-6 pt-16 pb-24">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-xs tracking-wide text-neutral-500 uppercase">
              Subscriptions
            </p>
            <h2 className="mt-3 text-2xl font-medium tracking-tight sm:text-3xl">
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
            className="inline-flex items-center rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
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
                    <span className="text-sm font-medium tracking-tight text-neutral-950">
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
