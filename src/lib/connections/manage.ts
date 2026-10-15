import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { accounts, connections, type ConnectionRole, type Platform } from "@/db/schema";
import { getAuth } from "@/lib/auth";
import { purgeUserYouTubeData } from "@/lib/retention/youtube";
import { removeConnectionRecords } from "./sync";
import { decryptToken } from "./tokens";

export class ConnectionActionError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

export async function listConnections(userId: string) {
  return getDb().select().from(connections).where(eq(connections.userId, userId)).orderBy(connections.createdAt);
}

export async function getOwnedConnection(userId: string, connectionId: string) {
  const [row] = await getDb()
    .select()
    .from(connections)
    .where(and(eq(connections.id, connectionId), eq(connections.userId, userId)))
    .limit(1);
  if (!row) {
    throw new ConnectionActionError("Connection not found.", 404);
  }
  return row;
}

/** The user's broadcaster connection for a platform: the requested one, or the oldest. */
export async function getBroadcasterConnection(userId: string, platform: Platform, connectionId?: string) {
  const [row] = await getDb()
    .select()
    .from(connections)
    .where(
      and(
        eq(connections.userId, userId),
        eq(connections.platform, platform),
        eq(connections.role, "broadcaster"),
        ...(connectionId ? [eq(connections.id, connectionId)] : []),
      ),
    )
    .orderBy(connections.createdAt)
    .limit(1);
  return row ?? null;
}

export async function setConnectionRole(userId: string, connectionId: string, role: ConnectionRole) {
  const connection = await getOwnedConnection(userId, connectionId);
  if (role === "bot" && connection.platform !== "twitch") {
    throw new ConnectionActionError("Only Twitch accounts can be bots right now.");
  }
  await getDb().update(connections).set({ role }).where(eq(connections.id, connection.id));
}

/**
 * Disconnects a platform account: revokes the platform grant, deletes the Better Auth
 * account (credentials), and removes the connection and its subscriptions. Disconnecting
 * YouTube also deletes everything Signal Kit stored from YouTube for the user right away
 * (YouTube Developer Policies: delete stored data when authorization is revoked).
 */
export async function disconnectConnection(userId: string, connectionId: string) {
  const connection = await getOwnedConnection(userId, connectionId);
  const userAccounts = await getDb().select({ id: accounts.id }).from(accounts).where(eq(accounts.userId, userId));
  if (userAccounts.length <= 1) {
    throw new ConnectionActionError("This is your only sign-in method. Connect another account before removing it.");
  }

  const [account] = await getDb().select().from(accounts).where(eq(accounts.id, connection.accountId)).limit(1);
  if (account?.accessToken) {
    await revokePlatformToken(connection.platform, await decryptToken(account.accessToken)).catch((error) => {
      // Revocation is best effort: the credentials are deleted locally either way.
      console.warn(`[connections] token revoke failed for ${connection.id}`, error);
    });
  }

  await removeConnectionRecords(connection.id);
  if (account) {
    const context = await getAuth().$context;
    await context.internalAdapter.deleteAccount(account.id);
  }
  if (connection.platform === "youtube") {
    // If this fails, the hourly retention run retries it (the user has YouTube data but no active YouTube connection).
    await purgeUserYouTubeData(userId).catch((error) => console.error(`[connections] YouTube data purge failed for ${userId}`, error));
  }
}

async function revokePlatformToken(platform: Platform, token: string) {
  let response: Response;
  if (platform === "twitch") {
    response = await fetch("https://id.twitch.tv/oauth2/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: process.env.TWITCH_CLIENT_ID ?? "", token }),
    });
  } else if (platform === "youtube") {
    response = await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
    });
  } else {
    const basic = Buffer.from(`${process.env.X_CLIENT_ID}:${process.env.X_CLIENT_SECRET}`).toString("base64");
    response = await fetch("https://api.x.com/2/oauth2/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${basic}` },
      body: new URLSearchParams({ token, token_type_hint: "access_token" }),
    });
  }
  if (!response.ok) {
    throw new Error(`${platform} revoke failed (${response.status})`);
  }
}
