import { randomUUID } from "crypto";
import { eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { connections, platformSubscriptions } from "@/db/schema";
import { stableJsonHash } from "@/lib/crypto";
import { eventCatalogForUser } from "./event-catalog";

/** Writes the EventSub subscriptions a Twitch broadcaster connection should have, based on its scopes. */
export async function syncDesiredSubscriptionsForConnection(connectionId: string) {
  const db = getDb();
  const [connection] = await db.select().from(connections).where(eq(connections.id, connectionId)).limit(1);
  if (!connection || connection.platform !== "twitch") {
    throw new Error("Twitch connection not found.");
  }

  const catalog = eventCatalogForUser({ id: connection.platformUserId, scopes: connection.scopes });
  const enabledEvents = catalog.filter((item) => item.enabledByScopes);

  const desiredKeys = new Set<string>();
  for (const item of enabledEvents) {
    const conditionHash = stableJsonHash(item.condition);
    desiredKeys.add(`${item.type}|${item.version}|${conditionHash}`);

    await db
      .insert(platformSubscriptions)
      .values({
        id: randomUUID(),
        connectionId: connection.id,
        platform: "twitch",
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
          status: sql`if(${platformSubscriptions.status} = 'failed', 'desired', ${platformSubscriptions.status})`,
          error: null,
        },
      });
  }

  const rows = await db
    .select({
      id: platformSubscriptions.id,
      type: platformSubscriptions.type,
      version: platformSubscriptions.version,
      conditionHash: platformSubscriptions.conditionHash,
      status: platformSubscriptions.status,
    })
    .from(platformSubscriptions)
    .where(eq(platformSubscriptions.connectionId, connection.id));

  const stale = rows
    .filter(
      (row) =>
        !desiredKeys.has(`${row.type}|${row.version}|${row.conditionHash}`) &&
        (row.status === "failed" || row.status === "desired" || row.status === "revoked"),
    )
    .map((row) => row.id);

  if (stale.length > 0) {
    await db.delete(platformSubscriptions).where(inArray(platformSubscriptions.id, stale));
  }

  return {
    desired: enabledEvents.length,
    skippedForScopes: catalog.length - enabledEvents.length,
    removed: stale.length,
  };
}
