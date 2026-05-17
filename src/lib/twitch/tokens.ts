import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { twitchUsers } from "@/db/schema";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { refreshTwitchToken } from "./api";

const REFRESH_WINDOW_MS = 5 * 60 * 1000;

export async function getUsableAccessToken(twitchUserId: string) {
  const [user] = await getDb().select().from(twitchUsers).where(eq(twitchUsers.id, twitchUserId)).limit(1);
  if (!user) {
    throw new Error(`Unknown Twitch user ${twitchUserId}.`);
  }

  const tokenExpiresAt = user.tokenExpiresAt?.getTime() ?? 0;
  if (tokenExpiresAt > Date.now() + REFRESH_WINDOW_MS) {
    return decryptSecret(user.accessTokenEncrypted);
  }

  const refreshed = await refreshTwitchToken(decryptSecret(user.refreshTokenEncrypted));
  const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000);
  await getDb()
    .update(twitchUsers)
    .set({
      accessTokenEncrypted: encryptSecret(refreshed.access_token),
      refreshTokenEncrypted: encryptSecret(refreshed.refresh_token),
      tokenExpiresAt: expiresAt,
      scopes: refreshed.scope ?? user.scopes,
    })
    .where(eq(twitchUsers.id, twitchUserId));

  return refreshed.access_token;
}
