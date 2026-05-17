import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { eventSubscriptions, overlayTokens } from "@/db/schema";
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

export async function getDashboardData(user: { id: string; scopes: string[] }) {
  const [tokens, subscriptions] = await Promise.all([
    getDb()
      .select({
        id: overlayTokens.id,
        label: overlayTokens.label,
        createdAt: overlayTokens.createdAt,
        lastUsedAt: overlayTokens.lastUsedAt,
        revokedAt: overlayTokens.revokedAt,
      })
      .from(overlayTokens)
      .where(eq(overlayTokens.twitchUserId, user.id))
      .orderBy(desc(overlayTokens.createdAt)),
    getDb()
      .select({
        type: eventSubscriptions.type,
        version: eventSubscriptions.version,
        status: eventSubscriptions.status,
        error: eventSubscriptions.error,
      })
      .from(eventSubscriptions)
      .where(eq(eventSubscriptions.twitchUserId, user.id)),
  ]);

  const subscriptionsByKey = new Map(
    subscriptions.map((subscription) => [`${subscription.type}|${subscription.version}`, subscription]),
  );

  const events: DashboardEvent[] = eventCatalogForUser({ id: user.id, scopes: user.scopes }).map(
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
  );

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

events.on("*", (message) => {
  console.log(message.type, message.event);
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
