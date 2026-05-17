import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { eventSubscriptions, overlayTokens } from "@/db/schema";
import { getWsUrl } from "@/lib/app-url";
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
  const connectionSnippet = `const ws = new WebSocket("${wsUrl}?token=sk_live_...");

ws.onmessage = (msg) => {
  const payload = JSON.parse(msg.data);
  console.log(payload.type, payload.event);
};`;

  const connectionHtml = await highlightCode(connectionSnippet, "javascript");

  return {
    tokens,
    events,
    wsUrl,
    connectionHtml,
  };
}
