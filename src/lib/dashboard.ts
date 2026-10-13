import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { getDb } from "@/db";
import { platformSubscriptions } from "@/db/schema";
import { getAppUrl, getWsUrl } from "@/lib/app-url";
import { getAuth } from "@/lib/auth";
import { getBroadcasterConnection, listConnections } from "@/lib/connections/manage";
import { toPublicConnection } from "@/lib/connections/public";
import { syncConnectionsForUser } from "@/lib/connections/sync";
import { highlightCode } from "@/lib/highlighter";
import { eventCatalogForUser } from "@/lib/twitch/event-catalog";

export type DashboardEventStatus =
  | "enabled"
  | "desired"
  | "failed"
  | "revoked"
  | "pending"
  | "scope";

export type DashboardEvent = {
  type: string;
  version: string;
  label: string;
  description: string;
  requiredScopes: string[];
  enabledByScopes: boolean;
  status: DashboardEventStatus;
  error: string | null;
};

export type DashboardSnippets = {
  npmInstall: string;
  scriptTag: string;
  browserExample: string;
  nodeExample: string;
};

export type DashboardApiKey = {
  id: string;
  name: string | null;
  start: string | null;
  enabled: boolean;
  createdAt: string;
  lastUsedAt: string | null;
};

/** Providers with OAuth credentials configured on this deployment. */
export function enabledProviders() {
  return {
    twitch: Boolean(process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET),
    google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    twitter: Boolean(process.env.X_CLIENT_ID && process.env.X_CLIENT_SECRET),
  };
}

export async function getDashboardData(user: { id: string }) {
  // Picks up accounts linked since the last visit; failures surface as connection statuses.
  await syncConnectionsForUser(user.id).catch((error) => {
    console.error("[dashboard] connection sync failed", error);
  });

  const [connectionRows, keyList, twitch] = await Promise.all([
    listConnections(user.id),
    getAuth().api.listApiKeys({ headers: await headers() }),
    getBroadcasterConnection(user.id, "twitch"),
  ]);
  const subscriptions = twitch
    ? await getDb()
        .select({
          type: platformSubscriptions.type,
          version: platformSubscriptions.version,
          status: platformSubscriptions.status,
          error: platformSubscriptions.error,
        })
        .from(platformSubscriptions)
        .where(eq(platformSubscriptions.connectionId, twitch.id))
    : [];

  const keys: DashboardApiKey[] = keyList.apiKeys
    .map((key) => ({
      id: key.id,
      name: key.name,
      start: key.start,
      enabled: key.enabled,
      createdAt: new Date(key.createdAt).toISOString(),
      lastUsedAt: key.lastRequest ? new Date(key.lastRequest).toISOString() : null,
    }))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  const subscriptionsByKey = new Map(
    subscriptions.map((subscription) => [`${subscription.type}|${subscription.version}`, subscription]),
  );

  const events: DashboardEvent[] = twitch
    ? eventCatalogForUser({ id: twitch.platformUserId, scopes: twitch.scopes }).map(
    (item) => {
      if (!item.enabledByScopes) {
        return {
          type: item.type,
          version: item.version,
          label: item.label,
          description: item.description,
          requiredScopes: item.requiredScopes,
          enabledByScopes: false,
          status: "scope",
          error: null,
        };
      }

      const subscription = subscriptionsByKey.get(`${item.type}|${item.version}`);
      const status: DashboardEventStatus = subscription
        ? ((subscription.status as DashboardEventStatus) ?? "pending")
        : "pending";

      return {
        type: item.type,
        version: item.version,
        label: item.label,
        description: item.description,
        requiredScopes: item.requiredScopes,
        enabledByScopes: true,
        status,
        error: subscription?.error ?? null,
      };
    },
      )
    : [];

  const wsUrl = getWsUrl();
  const appUrl = getAppUrl();

  const npmInstall = `npm install @signal-kit/client`;

  const scriptTag = `<script src="${appUrl}/twe-client.js"></script>`;

  const browserExample = `<script src="${appUrl}/twe-client.js"></script>
<script>
  const events = new SignalKit({
    url: "${wsUrl}",
    token: "sk_live_...", // an API key from the dashboard
  });

  events.on("channel.cheer", ({ event }) => {
    document.body.dataset.bits = event.bits;
  });

  events.on("youtube.live_chat.super_chat", ({ event }) => {
    console.log(event.snippet.displayMessage);
  });

  events.connect();
</script>`;

  const nodeExample = `import { SignalKit } from "@signal-kit/client";

const events = new SignalKit({
  url: process.env.SIGNAL_KIT_URL!,
  token: process.env.SIGNAL_KIT_TOKEN!,
});

events.on("channel.cheer", ({ event }) => {
  console.log(\`\${event.user_name} cheered \${event.bits} bits\`);
});

events.on("youtube.live_chat.message", ({ event }) => {
  console.log(event.authorDetails?.displayName, event.snippet?.displayMessage);
});

events.on("*", (message) => {
  console.log(message.provider, message.type, message.event);
});

events.connect();`;

  const [npmInstallHtml, scriptTagHtml, browserHtml, nodeHtml] = await Promise.all([
    highlightCode(npmInstall, "bash"),
    highlightCode(scriptTag, "html"),
    highlightCode(browserExample, "html"),
    highlightCode(nodeExample, "typescript"),
  ]);

  return {
    keys,
    connections: connectionRows.map(toPublicConnection),
    providers: enabledProviders(),
    events,
    wsUrl,
    appUrl,
    snippets: {
      npmInstall,
      scriptTag,
      browserExample,
      nodeExample,
    } satisfies DashboardSnippets,
    highlighted: {
      npmInstall: npmInstallHtml,
      scriptTag: scriptTagHtml,
      browserExample: browserHtml,
      nodeExample: nodeHtml,
    },
  };
}
