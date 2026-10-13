"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ConnectButton, type ProviderId } from "@/components/AuthButtons";
import type { PublicConnection } from "@/lib/connections/public";

type ApiKeyRow = {
  id: string;
  name: string | null;
  start: string | null;
  enabled: boolean;
  createdAt: string;
  lastUsedAt: string | null;
};

type EnabledProviders = Record<ProviderId, boolean>;

const PLATFORM_PROVIDER: Record<PublicConnection["platform"], ProviderId> = {
  twitch: "twitch",
  youtube: "google",
  x: "twitter",
};

const PLATFORM_LABEL: Record<PublicConnection["platform"], string> = {
  twitch: "Twitch",
  youtube: "YouTube",
  x: "X",
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

type DashboardPanel = "accounts" | "broadcast" | "tokens" | "subscriptions";

type BroadcastSettings = {
  twitch?: {
    connected: boolean;
    canUpdate?: boolean;
    needsReconnect?: boolean;
    channel?: {
      title: string;
      game_id: string;
      game_name: string;
      broadcaster_language: string;
    } | null;
  };
  youtube?: {
    connected: boolean;
    canUpdate?: boolean;
    needsReconnect?: boolean;
    broadcasts?: Array<{
      id: string;
      title: string;
      lifeCycleStatus: string;
      scheduledStartTime: string | null;
    }>;
    video?: {
      id: string;
      title: string;
      description: string;
      categoryId: string;
      privacyStatus: "public" | "unlisted" | "private";
    } | null;
  };
};

export function DashboardClient({
  initialKeys,
  connections,
  providers,
  events,
  wsUrl,
  appUrl,
  snippets,
  highlighted,
}: {
  initialKeys: ApiKeyRow[];
  connections: PublicConnection[];
  providers: EnabledProviders;
  events: DashboardEvent[];
  wsUrl: string;
  appUrl: string;
  snippets: Snippets;
  highlighted: Highlighted;
}) {
  const [tokens, setTokens] = useState(initialKeys);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<DashboardPanel>("broadcast");

  async function createToken() {
    setStatus("Creating API key...");
    const response = await fetch("/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: `API key ${tokens.length + 1}` }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setStatus(payload.error ?? "API key creation failed.");
      return;
    }
    setNewToken(payload.key);
    await refreshKeys();
    setStatus("API key created. Copy it now — it is only shown once.");
  }

  async function revokeToken(id: string) {
    const response = await fetch(`/api/keys/${id}`, { method: "DELETE" });
    const payload = await response.json();
    setStatus(response.ok ? "API key revoked." : (payload.error ?? "Revoke failed."));
    await refreshKeys();
  }

  async function refreshKeys() {
    const refreshed = await fetch("/api/keys").then((res) => res.json());
    setTokens(refreshed.keys ?? []);
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
        <div className="fixed right-4 bottom-4 z-50 max-w-[calc(100vw-2rem)] rounded-full border border-neutral-200 bg-white/95 px-4 py-2 font-mono text-xs text-neutral-700 shadow-lg shadow-neutral-950/10 backdrop-blur sm:right-6 sm:bottom-6">
          <div className="max-w-[32rem] truncate">
            {status}
          </div>
        </div>
      ) : null}

      <div className="border-b border-neutral-200 bg-[#f7f5f1]">
        <div className="mx-auto grid w-full max-w-6xl gap-5 px-6 py-6 lg:grid-cols-[11rem_minmax(0,1fr)] lg:items-start lg:py-8">
          <DashboardTabs
            activePanel={activePanel}
            onChange={setActivePanel}
            counts={{ accounts: connections.length, tokens: tokens.length, subscriptions: events.length }}
          />
          <div className="min-h-[42rem] min-w-0 overflow-hidden rounded-[1.35rem] border border-neutral-200 bg-white shadow-sm shadow-neutral-950/[0.04] ring-1 ring-black/[0.03]">
            {activePanel === "accounts" ? (
              <Accounts connections={connections} providers={providers} onStatus={setStatus} />
            ) : null}
            {activePanel === "broadcast" ? <BroadcastDetails onStatus={setStatus} /> : null}
            {activePanel === "tokens" ? (
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
            ) : null}
            {activePanel === "subscriptions" ? <Events events={events} onSync={syncSubscriptions} /> : null}
          </div>
        </div>
      </div>
    </>
  );
}

function DashboardTabs({
  activePanel,
  onChange,
  counts,
}: {
  activePanel: DashboardPanel;
  onChange: (panel: DashboardPanel) => void;
  counts: { accounts: number; tokens: number; subscriptions: number };
}) {
  const tabs: Array<{ id: DashboardPanel; label: string; meta?: string }> = [
    { id: "accounts", label: "Accounts", meta: String(counts.accounts) },
    { id: "broadcast", label: "Broadcast" },
    { id: "tokens", label: "API keys", meta: String(counts.tokens) },
    { id: "subscriptions", label: "Twitch Events", meta: String(counts.subscriptions) },
  ];

  return (
    <nav aria-label="Dashboard sections" className="lg:sticky lg:top-20">
      <div className="flex gap-2 overflow-x-auto rounded-full border border-neutral-200 bg-white/70 p-1 shadow-sm shadow-neutral-950/[0.03] lg:flex-col lg:overflow-visible lg:rounded-[1.25rem] lg:p-1.5">
        {tabs.map((tab) => {
          const active = tab.id === activePanel;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={
                active
                  ? "inline-flex shrink-0 items-center justify-between gap-3 rounded-full bg-neutral-950 px-3 py-2 text-sm text-white lg:bg-white lg:text-neutral-950 lg:ring-1 lg:ring-neutral-200"
                  : "inline-flex shrink-0 items-center justify-between gap-3 rounded-full px-3 py-2 text-sm text-neutral-600 hover:bg-white hover:text-neutral-950"
              }
            >
              <span>{tab.label}</span>
              {tab.meta ? (
                <span className={active ? "font-mono text-xs text-white/55 lg:text-neutral-400" : "font-mono text-xs text-neutral-400"}>
                  {tab.meta}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function BroadcastDetails({ onStatus }: { onStatus: (status: string | null) => void }) {
  const [settings, setSettings] = useState<BroadcastSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [useSharedTitle, setUseSharedTitle] = useState(true);
  const [sharedTitle, setSharedTitle] = useState("");
  const [twitchTitle, setTwitchTitle] = useState("");
  const [youtubeTitle, setYoutubeTitle] = useState("");
  const [youtubeDescription, setYoutubeDescription] = useState("");
  const [youtubePrivacy, setYoutubePrivacy] = useState<"public" | "unlisted" | "private">("private");

  async function loadSettings() {
    setLoading(true);
    const response = await fetch("/api/broadcast-settings");
    const payload = await response.json();
    setLoading(false);
    if (!response.ok) {
      onStatus(payload.error ?? "Could not load broadcast settings.");
      return;
    }
    setSettings(payload);
    setTwitchTitle(payload.twitch?.channel?.title ?? "");
    setYoutubeTitle(payload.youtube?.video?.title ?? "");
    setYoutubeDescription(payload.youtube?.video?.description ?? "");
    setYoutubePrivacy(payload.youtube?.video?.privacyStatus ?? "private");
    setSharedTitle(payload.twitch?.channel?.title ?? payload.youtube?.video?.title ?? "");
  }

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/broadcast-settings")
      .then(async (response) => ({ response, payload: await response.json() }))
      .then(({ response, payload }) => {
        if (cancelled) {
          return;
        }
        setLoading(false);
        if (!response.ok) {
          onStatus(payload.error ?? "Could not load broadcast settings.");
          return;
        }
        setSettings(payload);
        setTwitchTitle(payload.twitch?.channel?.title ?? "");
        setYoutubeTitle(payload.youtube?.video?.title ?? "");
        setYoutubeDescription(payload.youtube?.video?.description ?? "");
        setYoutubePrivacy(payload.youtube?.video?.privacyStatus ?? "private");
        setSharedTitle(payload.twitch?.channel?.title ?? payload.youtube?.video?.title ?? "");
      });
    return () => {
      cancelled = true;
    };
  }, [onStatus]);

  async function saveSharedTitles() {
    if (!sharedTitle.trim()) {
      onStatus("Enter a shared title first.");
      return;
    }

    onStatus("Updating connected provider titles...");
    const jobs: Promise<Response>[] = [];
    if (settings?.twitch?.canUpdate) {
      jobs.push(postBroadcastSettings({ provider: "twitch", title: sharedTitle }));
    }
    if (settings?.youtube?.canUpdate && settings.youtube.video) {
      jobs.push(postBroadcastSettings({ provider: "youtube", broadcastId: settings.youtube.video.id, title: sharedTitle }));
    }

    if (jobs.length === 0) {
      onStatus("No connected providers can update titles yet. Reconnect providers to grant write scopes.");
      return;
    }

    const responses = await Promise.all(jobs);
    const failed = responses.find((response) => !response.ok);
    if (failed) {
      const payload = await failed.json().catch(() => ({}));
      onStatus(payload.error ?? "One or more title updates failed.");
      return;
    }

    onStatus("Connected provider titles updated.");
    await loadSettings();
  }

  async function saveTwitch() {
    onStatus("Updating Twitch title...");
    const response = await fetch("/api/broadcast-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "twitch", title: twitchTitle }),
    });
    const payload = await response.json();
    onStatus(response.ok ? "Twitch title updated." : (payload.error ?? "Twitch update failed."));
    if (response.ok) {
      await loadSettings();
    }
  }

  async function saveYouTube() {
    const broadcastId = settings?.youtube?.video?.id;
    if (!broadcastId) {
      onStatus("No editable YouTube broadcast found.");
      return;
    }
    onStatus("Updating YouTube broadcast details...");
    const response = await fetch("/api/broadcast-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "youtube",
        broadcastId,
        ...(useSharedTitle ? {} : { title: youtubeTitle }),
        description: youtubeDescription,
        privacyStatus: youtubePrivacy,
      }),
    });
    const payload = await response.json();
    onStatus(response.ok ? "YouTube broadcast details updated." : (payload.error ?? "YouTube update failed."));
    if (response.ok) {
      await loadSettings();
    }
  }

  return (
    <section>
      <div className="p-5 sm:p-6">
        <div>
          <p className="font-mono text-xs tracking-wide text-neutral-500 uppercase">
            Broadcast details
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
            Update stream metadata from Signal Kit
          </h2>
          <p className="mt-2 max-w-[64ch] text-pretty text-neutral-600">
            Update a shared title across connected providers by default. Uncheck the shared-title
            option to split Twitch and YouTube titles. YouTube description and privacy stay separate.
          </p>
        </div>

        {loading ? (
          <div className="mt-8 grid gap-6 lg:grid-cols-2" aria-hidden="true">
            <PanelSkeleton />
            <PanelSkeleton />
          </div>
        ) : null}

        {!loading ? (
        <>
        <div className="mt-8 rounded-xl border border-neutral-200 bg-[#faf9f6] p-5">
          <label className="flex items-start gap-3 text-sm font-medium text-neutral-800">
            <input
              type="checkbox"
              checked={useSharedTitle}
              onChange={(event) => setUseSharedTitle(event.target.checked)}
              className="mt-1 size-4 rounded border-neutral-300 text-violet-600"
            />
            <span>
              Use one shared title for Twitch and YouTube
              <span className="mt-1 block font-normal text-neutral-600">
                Default on. Turn this off when each platform needs its own title.
              </span>
            </span>
          </label>
          {useSharedTitle ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <LabelledInput label="Shared title" value={sharedTitle} onChange={setSharedTitle} />
              <button
                type="button"
                onClick={saveSharedTitles}
                className="inline-flex items-center justify-center rounded-md bg-violet-600 px-3 py-2 text-sm font-semibold text-white ring-1 ring-violet-600 hover:bg-violet-700"
              >
                Save title to connected providers
              </button>
            </div>
          ) : null}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <ProviderPanel title="Twitch" connected={Boolean(settings?.twitch?.connected)}>
            {settings?.twitch?.needsReconnect ? <ReconnectNotice provider="twitch" label="Twitch" /> : null}
            {useSharedTitle ? (
              <p className="text-sm text-neutral-600">
                Current title: <span className="font-medium text-neutral-950">{settings?.twitch?.channel?.title ?? "Untitled"}</span>
              </p>
            ) : (
              <>
                <LabelledInput label="Twitch title" value={twitchTitle} onChange={setTwitchTitle} disabled={!settings?.twitch?.canUpdate} />
                <button
                  type="button"
                  onClick={saveTwitch}
                  disabled={!settings?.twitch?.canUpdate}
                  className="mt-4 inline-flex items-center rounded-md bg-violet-600 px-3 py-2 text-sm font-semibold text-white ring-1 ring-violet-600 hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Save Twitch title
                </button>
              </>
            )}
          </ProviderPanel>

          <ProviderPanel title="YouTube" connected={Boolean(settings?.youtube?.connected)}>
            {settings?.youtube?.needsReconnect ? <ReconnectNotice provider="google" label="YouTube" /> : null}
            {settings?.youtube?.connected && !settings.youtube.video ? (
              <p className="text-sm text-neutral-500">No active or upcoming YouTube broadcast found.</p>
            ) : null}
            {useSharedTitle ? (
              <p className="text-sm text-neutral-600">
                Current title: <span className="font-medium text-neutral-950">{settings?.youtube?.video?.title ?? "Untitled"}</span>
              </p>
            ) : (
              <LabelledInput label="YouTube title" value={youtubeTitle} onChange={setYoutubeTitle} disabled={!settings?.youtube?.canUpdate || !settings?.youtube?.video} />
            )}
            <LabelledTextarea label="Description" value={youtubeDescription} onChange={setYoutubeDescription} disabled={!settings?.youtube?.canUpdate || !settings?.youtube?.video} />
            <label className="mt-4 block text-sm font-medium text-neutral-700">
              Privacy
              <select
                value={youtubePrivacy}
                onChange={(event) => setYoutubePrivacy(event.target.value as "public" | "unlisted" | "private")}
                disabled={!settings?.youtube?.canUpdate || !settings?.youtube?.video}
                className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 disabled:bg-neutral-100 disabled:text-neutral-500"
              >
                <option value="public">Public</option>
                <option value="unlisted">Unlisted</option>
                <option value="private">Private</option>
              </select>
            </label>
            <button
              type="button"
              onClick={saveYouTube}
              disabled={!settings?.youtube?.canUpdate || !settings?.youtube?.video}
              className="mt-4 inline-flex items-center rounded-md bg-neutral-950 px-3 py-2 text-sm font-semibold text-white ring-1 ring-neutral-950 hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save YouTube
            </button>
          </ProviderPanel>
        </div>
        </>
        ) : null}
      </div>
    </section>
  );
}

function PanelSkeleton() {
  return (
    <div className="min-h-[21rem] rounded-xl border border-neutral-200 bg-white p-5">
      <div className="h-4 w-24 rounded-full bg-neutral-100" />
      <div className="mt-6 h-10 rounded-md bg-neutral-100" />
      <div className="mt-4 h-10 rounded-md bg-neutral-100" />
      <div className="mt-4 h-24 rounded-md bg-neutral-100" />
    </div>
  );
}

function postBroadcastSettings(body: Record<string, unknown>) {
  return fetch("/api/broadcast-settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function ProviderPanel({ title, connected, children }: { title: string; connected: boolean; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5">
      <div className="mb-5 flex items-center justify-between gap-4">
        <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
        <span className={`font-mono text-xs uppercase ${connected ? "text-emerald-700" : "text-neutral-500"}`}>
          {connected ? "connected" : "not connected"}
        </span>
      </div>
      {connected ? children : <p className="text-sm text-neutral-500">Connect {title} to manage its broadcast details.</p>}
    </div>
  );
}

function ReconnectNotice({ provider, label }: { provider: ProviderId; label: string }) {
  return (
    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
      Reconnect {label} to restore access or grant metadata update scopes.{" "}
      <ConnectButton provider={provider} mode="link" className="font-semibold underline">
        Reconnect
      </ConnectButton>
    </div>
  );
}

function LabelledInput({
  label,
  value,
  onChange,
  disabled,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="mt-4 block text-sm font-medium text-neutral-700">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 disabled:bg-neutral-100 disabled:text-neutral-500"
      />
    </label>
  );
}

function LabelledTextarea({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="mt-4 block text-sm font-medium text-neutral-700">
      {label}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        rows={4}
        className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 disabled:bg-neutral-100 disabled:text-neutral-500"
      />
    </label>
  );
}

const primaryButton =
  "inline-flex items-center rounded-md bg-violet-600 px-3 py-2 text-sm font-semibold text-white ring-1 ring-violet-600 hover:bg-violet-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 disabled:opacity-60";
const secondaryButton =
  "inline-flex items-center rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 disabled:opacity-60";

function Accounts({
  connections,
  providers,
  onStatus,
}: {
  connections: PublicConnection[];
  providers: EnabledProviders;
  onStatus: (status: string) => void;
}) {
  const router = useRouter();

  async function disconnect(connection: PublicConnection) {
    if (!window.confirm(`Disconnect ${connection.displayName} (${PLATFORM_LABEL[connection.platform]})?`)) {
      return;
    }
    const response = await fetch(`/api/connections/${connection.id}`, { method: "DELETE" });
    const payload = await response.json();
    onStatus(response.ok ? "Account disconnected." : (payload.error ?? "Disconnect failed."));
    router.refresh();
  }

  async function setRole(connection: PublicConnection, role: "broadcaster" | "bot") {
    const response = await fetch(`/api/connections/${connection.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    const payload = await response.json();
    onStatus(response.ok ? `Marked as ${role}.` : (payload.error ?? "Update failed."));
    router.refresh();
  }

  return (
    <section>
      <div className="p-5 sm:p-6">
        <div className="flex flex-col gap-4">
          <div>
            <p className="font-mono text-xs tracking-wide text-neutral-500 uppercase">
              Connected accounts
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
              Connect any platform, as many accounts as you need
            </h2>
            <p className="mt-2 max-w-[62ch] text-pretty text-neutral-600">
              Every connected account shares the same API keys. Add a separate Twitch bot account to
              read and send chat under its own name. Any connected account can also be used to sign in.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {providers.twitch ? (
              <>
                <ConnectButton provider="twitch" mode="link" className={primaryButton}>
                  Connect Twitch channel
                </ConnectButton>
                <ConnectButton provider="twitch" mode="link" role="bot" className={secondaryButton}>
                  Connect Twitch bot
                </ConnectButton>
              </>
            ) : null}
            {providers.google ? (
              <ConnectButton provider="google" mode="link" className={secondaryButton}>
                Connect YouTube
              </ConnectButton>
            ) : null}
            {providers.twitter ? (
              <ConnectButton provider="twitter" mode="link" className={secondaryButton}>
                Connect X
              </ConnectButton>
            ) : null}
          </div>
        </div>

        <ul role="list" className="mt-8 divide-y divide-neutral-200 border-t border-neutral-200">
          {connections.map((connection) => (
            <li
              key={connection.id}
              className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-center gap-3">
                {connection.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={connection.avatarUrl}
                    alt=""
                    className="size-10 rounded-full bg-neutral-100 object-cover"
                  />
                ) : (
                  <div className="flex size-10 items-center justify-center rounded-full bg-neutral-100 font-mono text-xs text-neutral-500 uppercase">
                    {connection.platform.slice(0, 2)}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="truncate text-sm font-semibold tracking-tight">
                      {connection.displayName}
                    </span>
                    <span className="font-mono text-xs text-neutral-500 uppercase">
                      {PLATFORM_LABEL[connection.platform]} · {connection.role}
                    </span>
                  </div>
                  <div className="mt-1 truncate font-mono text-xs text-neutral-500">
                    @{connection.username} · {connection.scopes.length} scopes · last event{" "}
                    {connection.lastEventAt ? new Date(connection.lastEventAt).toLocaleString() : "none yet"}
                  </div>
                  {connection.status !== "active" ? (
                    <div
                      className="mt-2 max-w-[72ch] truncate font-mono text-xs text-red-700"
                      title={connection.statusReason ?? undefined}
                    >
                      {connection.status === "needs_reauth" ? "Needs reconnect" : "Error"}
                      {connection.statusReason ? ` · ${connection.statusReason}` : ""}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {connection.status !== "active" ? (
                  <ConnectButton
                    provider={PLATFORM_PROVIDER[connection.platform]}
                    mode="link"
                    role={connection.role}
                    className={primaryButton}
                  >
                    Reconnect
                  </ConnectButton>
                ) : null}
                {connection.platform === "twitch" ? (
                  <button
                    type="button"
                    className={secondaryButton}
                    onClick={() => setRole(connection, connection.role === "bot" ? "broadcaster" : "bot")}
                  >
                    {connection.role === "bot" ? "Use as channel" : "Use as bot"}
                  </button>
                ) : null}
                <button type="button" className={secondaryButton} onClick={() => disconnect(connection)}>
                  Disconnect
                </button>
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
  tokens: ApiKeyRow[];
  newToken: string | null;
  wsUrl: string;
  appUrl: string;
  snippets: Snippets;
  highlighted: Highlighted;
  onCreate: () => void;
  onRevoke: (id: string) => void;
}) {
  return (
    <section>
      <div className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-xs tracking-wide text-neutral-500 uppercase">
              API keys
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
              Keys for overlays, bots, and agents
            </h2>
            <p className="mt-2 max-w-[60ch] text-pretty text-neutral-600">
              Pass a key in the WebSocket URL. Keys are shown once, stored only as a hash, and revoking one
              disconnects its open sockets immediately.
            </p>
          </div>
          <button
            type="button"
            onClick={onCreate}
            className="inline-flex items-center rounded-md bg-violet-600 px-3 py-2 text-sm font-semibold text-white ring-1 ring-violet-600 hover:bg-violet-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600"
          >
            Create API key
          </button>
        </div>

        {newToken ? <NewTokenReveal token={newToken} /> : null}

        <div className="mt-8">
          {tokens.length === 0 ? (
            <p className="border-t border-neutral-200 pt-6 text-sm text-neutral-500">
              No API keys yet. Create one to start connecting overlays.
            </p>
          ) : (
            <ul role="list" className="divide-y divide-neutral-200 border-t border-neutral-200">
              {tokens.map((token) => (
                <li
                  key={token.id}
                  className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="text-sm font-semibold tracking-tight">{token.name ?? "API key"}</div>
                    <div className="mt-1 font-mono text-xs text-neutral-500">
                      {token.start ? `${token.start}… · ` : ""}
                      {token.enabled ? "active" : "disabled"} · last used{" "}
                      {token.lastUsedAt
                        ? new Date(token.lastUsedAt).toLocaleString()
                        : "never"}
                    </div>
                  </div>
                  {token.enabled ? (
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
        <span>new api key</span>
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

  const tokenForPrompt = newToken ?? "<paste-your-api-key-here>";
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
      <div className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-xs tracking-wide text-neutral-500 uppercase">
              Subscriptions
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
              Twitch EventSub state
            </h2>
            <p className="mt-2 max-w-[60ch] text-pretty text-neutral-600">
              Twitch subscriptions are managed through EventSub. YouTube Live Chat runs separately
              from active broadcasts and does not appear in this table.
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
