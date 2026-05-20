import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { connectedAccounts } from "@/db/schema";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { refreshGoogleToken } from "./api";

export async function getUsableYouTubeAccessToken(accountId: string) {
  const [account] = await getDb()
    .select()
    .from(connectedAccounts)
    .where(eq(connectedAccounts.id, accountId))
    .limit(1);

  if (!account || account.provider !== "youtube") {
    throw new Error(`Unknown YouTube account ${accountId}.`);
  }

  if (account.tokenExpiresAt && account.tokenExpiresAt.getTime() > Date.now() + 60_000) {
    return decryptSecret(account.accessTokenEncrypted);
  }

  const refreshed = await refreshGoogleToken(decryptSecret(account.refreshTokenEncrypted));
  const tokenExpiresAt = refreshed.expires_in
    ? new Date(Date.now() + refreshed.expires_in * 1000)
    : account.tokenExpiresAt;
  const scopes = refreshed.scope ? refreshed.scope.split(" ").filter(Boolean) : account.scopes;

  await getDb()
    .update(connectedAccounts)
    .set({
      accessTokenEncrypted: encryptSecret(refreshed.access_token),
      tokenExpiresAt,
      scopes,
      lastError: null,
    })
    .where(eq(connectedAccounts.id, account.id));

  return refreshed.access_token;
}
