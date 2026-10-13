import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { connections } from "@/db/schema";
import { TWITCH_BOT_FEATURE_SCOPES } from "@/lib/auth/scopes";

/** The chat bot's settings, plus what the dashboard needs to explain its state. */
export async function botContext(userId: string) {
  const rows = await getDb()
    .select({ id: connections.id, role: connections.role, displayName: connections.displayName, scopes: connections.scopes, status: connections.status })
    .from(connections)
    .where(and(eq(connections.userId, userId), eq(connections.platform, "twitch")));
  const broadcaster = rows.find((row) => row.role !== "bot");
  return {
    twitch: broadcaster ? { name: broadcaster.displayName, status: broadcaster.status, missingScopes: TWITCH_BOT_FEATURE_SCOPES.filter((scope) => !broadcaster.scopes.includes(scope)) } : null,
    bots: rows.filter((row) => row.role === "bot").map((row) => ({ id: row.id, name: row.displayName, status: row.status })),
  };
}

