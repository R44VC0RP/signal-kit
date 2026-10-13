import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getAppUrl, getWsUrl } from "@/lib/app-url";
import { getAuth } from "@/lib/auth";
import { listConnections } from "@/lib/connections/manage";
import { toPublicConnection } from "@/lib/connections/public";
import { syncConnectionsForUser } from "@/lib/connections/sync";
import { getCurrentUser } from "@/lib/session";

/** Providers with OAuth credentials configured on this deployment. */
export function enabledProviders() {
  return {
    twitch: Boolean(process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET),
    google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    twitter: Boolean(process.env.X_CLIENT_ID && process.env.X_CLIENT_SECRET),
  };
}

/** The signed-in user, or a redirect to sign-in. Cached per request. */
export const requireDashboardUser = cache(async () => {
  const user = await getCurrentUser().catch(() => null);
  if (!user) {
    redirect("/sign-in");
  }
  return user;
});

/** Connections, synced first so newly linked accounts show up. Cached per request. */
export const loadConnections = cache(async (userId: string) => {
  await syncConnectionsForUser(userId).catch((error) => {
    console.error("[dashboard] connection sync failed", error);
  });
  return (await listConnections(userId)).map(toPublicConnection);
});

export type DashboardApiKey = {
  id: string;
  name: string | null;
  start: string | null;
  enabled: boolean;
  createdAt: string;
  lastUsedAt: string | null;
};

export const loadApiKeys = cache(async (): Promise<DashboardApiKey[]> => {
  const result = await getAuth().api.listApiKeys({ headers: await headers() });
  return result.apiKeys
    .filter((key) => key.enabled)
    .map((key) => ({
      id: key.id,
      name: key.name,
      start: key.start,
      enabled: key.enabled,
      createdAt: new Date(key.createdAt).toISOString(),
      lastUsedAt: key.lastRequest ? new Date(key.lastRequest).toISOString() : null,
    }))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
});

export function relayUrls() {
  return { appUrl: getAppUrl(), wsUrl: getWsUrl() };
}
