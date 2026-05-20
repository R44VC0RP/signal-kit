import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { overlayTokens } from "@/db/schema";
import { tokenHash } from "@/lib/crypto";

export async function authenticateOverlayToken(rawToken: string) {
  const [token] = await getDb()
    .select()
    .from(overlayTokens)
    .where(and(eq(overlayTokens.tokenHash, tokenHash(rawToken)), isNull(overlayTokens.revokedAt)))
    .limit(1);

  if (!token) {
    return null;
  }

  await getDb().update(overlayTokens).set({ lastUsedAt: new Date() }).where(eq(overlayTokens.id, token.id));
  const userId = token.appUserId ?? token.twitchUserId;
  return userId ? { userId, tokenId: token.id, label: token.label } : null;
}
