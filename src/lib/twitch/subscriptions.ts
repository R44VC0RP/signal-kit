import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { eventSubscriptions, twitchUsers } from "@/db/schema";
import { randomToken, stableJsonHash } from "@/lib/crypto";
import { eventCatalogForUser } from "./event-catalog";

export async function syncDesiredSubscriptionsForUser(twitchUserId: string) {
  const [user] = await getDb().select().from(twitchUsers).where(eq(twitchUsers.id, twitchUserId)).limit(1);
  if (!user) {
    throw new Error("You need to connect Twitch first.");
  }

  const catalog = eventCatalogForUser({ id: user.id, scopes: user.scopes });
  const enabledEvents = catalog.filter((item) => item.enabledByScopes);

  const desiredKeys = new Set<string>();
  for (const item of enabledEvents) {
    const conditionHash = stableJsonHash(item.condition);
    desiredKeys.add(`${item.type}|${item.version}|${conditionHash}`);

    await getDb()
      .insert(eventSubscriptions)
      .values({
        id: randomToken(24),
        twitchUserId: user.id,
        type: item.type,
        version: item.version,
        conditionHash,
        conditionJson: item.condition,
        requiredScopes: item.requiredScopes,
        status: "desired",
      })
      .onDuplicateKeyUpdate({
        set: {
          requiredScopes: item.requiredScopes,
          status: sql`if(${eventSubscriptions.status} = 'failed', 'desired', ${eventSubscriptions.status})`,
          error: null,
        },
      });
  }

  const userRows = await getDb()
    .select({
      id: eventSubscriptions.id,
      type: eventSubscriptions.type,
      version: eventSubscriptions.version,
      conditionHash: eventSubscriptions.conditionHash,
      status: eventSubscriptions.status,
    })
    .from(eventSubscriptions)
    .where(eq(eventSubscriptions.twitchUserId, user.id));

  const stale = userRows
    .filter(
      (row) =>
        !desiredKeys.has(`${row.type}|${row.version}|${row.conditionHash}`) &&
        (row.status === "failed" || row.status === "desired" || row.status === "revoked"),
    )
    .map((row) => row.id);

  let removed = 0;
  if (stale.length > 0) {
    await getDb().delete(eventSubscriptions).where(inArray(eventSubscriptions.id, stale));
    removed = stale.length;
  }

  return {
    desired: enabledEvents.length,
    skippedForScopes: catalog.length - enabledEvents.length,
    removed,
  };
}

export async function listDesiredSubscriptions(twitchUserId: string) {
  return getDb()
    .select()
    .from(eventSubscriptions)
    .where(and(eq(eventSubscriptions.twitchUserId, twitchUserId), eq(eventSubscriptions.status, "desired")));
}
