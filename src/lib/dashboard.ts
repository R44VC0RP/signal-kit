import { desc, eq, or } from "drizzle-orm";
import { getDb } from "@/db";
import { connectedAccounts, eventSubscriptions, overlayTokens, twitchUsers } from "@/db/schema";
import { getAppUrl, getWsUrl } from "@/lib/app-url";
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

export type DashboardConnectedAccount = {
  id: string;
  provider: string;
  providerAccountId: string;
  login: string;
  displayName: string;
  profileImageUrl: string | null;
  scopes: string[];
  lastSyncAt: Date | null;
  lastEventAt: Date | null;
  lastError: string | null;
  connectedAt: Date | null;
};

export async function getDashboardData(user: {
  id: string;
  displayName: string;
  profileImageUrl: string | null;
  twitchUserId: string | null;
  twitchLogin: string | null;
  twitchDisplayName: string | null;
  twitchProfileImageUrl: string | null;
  twitchScopes: string[];
}) {
  const [twitchAccount] = user.twitchUserId
    ? await getDb().select().from(twitchUsers).where(eq(twitchUsers.id, user.twitchUserId)).limit(1)
    : await getDb().select().from(twitchUsers).where(eq(twitchUsers.appUserId, user.id)).limit(1);

  const twitchUserId = twitchAccount?.id ?? user.twitchUserId;
  const [tokens, subscriptions, linkedAccounts] = await Promise.all([
    getDb()
      .select({
        id: overlayTokens.id,
        label: overlayTokens.label,
        createdAt: overlayTokens.createdAt,
        lastUsedAt: overlayTokens.lastUsedAt,
        revokedAt: overlayTokens.revokedAt,
      })
      .from(overlayTokens)
      .where(or(eq(overlayTokens.appUserId, user.id), eq(overlayTokens.twitchUserId, user.id)))
      .orderBy(desc(overlayTokens.createdAt)),
    twitchUserId
      ? getDb()
          .select({
            type: eventSubscriptions.type,
            version: eventSubscriptions.version,
            status: eventSubscriptions.status,
            error: eventSubscriptions.error,
          })
          .from(eventSubscriptions)
          .where(eq(eventSubscriptions.twitchUserId, twitchUserId))
      : Promise.resolve([]),
    getDb()
      .select({
        id: connectedAccounts.id,
        provider: connectedAccounts.provider,
        providerAccountId: connectedAccounts.providerAccountId,
        login: connectedAccounts.login,
        displayName: connectedAccounts.displayName,
        profileImageUrl: connectedAccounts.profileImageUrl,
        scopes: connectedAccounts.scopes,
        lastSyncAt: connectedAccounts.lastSyncAt,
        lastEventAt: connectedAccounts.lastEventAt,
        lastError: connectedAccounts.lastError,
        connectedAt: connectedAccounts.connectedAt,
      })
      .from(connectedAccounts)
      .where(or(eq(connectedAccounts.appUserId, user.id), eq(connectedAccounts.ownerTwitchUserId, user.id)))
      .orderBy(desc(connectedAccounts.connectedAt)),
  ]);

  const subscriptionsByKey = new Map(
    subscriptions.map((subscription) => [`${subscription.type}|${subscription.version}`, subscription]),
  );

  const events: DashboardEvent[] = twitchUserId
    ? eventCatalogForUser({ id: twitchUserId, scopes: twitchAccount?.scopes ?? user.twitchScopes }).map(
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
    tokens,
    accounts: [
      ...(twitchAccount
        ? [
            {
              id: twitchAccount.id,
              provider: "twitch",
              providerAccountId: twitchAccount.id,
              login: twitchAccount.login,
              displayName: twitchAccount.displayName,
              profileImageUrl: twitchAccount.profileImageUrl,
              scopes: twitchAccount.scopes,
              lastSyncAt: null,
              lastEventAt: null,
              lastError: null,
              connectedAt: twitchAccount.connectedAt,
            },
          ]
        : []),
      ...linkedAccounts,
    ] satisfies DashboardConnectedAccount[],
    hasTwitch: Boolean(twitchAccount),
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
