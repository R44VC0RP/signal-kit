import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { appUsers, connectedAccounts, twitchUsers } from "@/db/schema";
import { randomToken } from "@/lib/crypto";

export async function ensureAppUser({
  id,
  displayName,
  profileImageUrl,
  primaryProvider,
}: {
  id?: string | null;
  displayName: string;
  profileImageUrl?: string | null;
  primaryProvider: string;
}) {
  const appUserId = id ?? randomToken(24);
  await getDb()
    .insert(appUsers)
    .values({ id: appUserId, displayName, profileImageUrl: profileImageUrl ?? null, primaryProvider })
    .onDuplicateKeyUpdate({
      set: {
        displayName,
        profileImageUrl: profileImageUrl ?? null,
      },
    });
  return appUserId;
}

export async function findAppUserIdForTwitch(twitchUserId: string) {
  const [row] = await getDb()
    .select({ appUserId: twitchUsers.appUserId })
    .from(twitchUsers)
    .where(eq(twitchUsers.id, twitchUserId))
    .limit(1);
  return row?.appUserId ?? null;
}

export async function findAppUserIdForConnectedAccount(provider: string, providerAccountId: string) {
  const [row] = await getDb()
    .select({ appUserId: connectedAccounts.appUserId })
    .from(connectedAccounts)
    .where(and(eq(connectedAccounts.provider, provider), eq(connectedAccounts.providerAccountId, providerAccountId)))
    .limit(1);
  return row?.appUserId ?? null;
}
