import { symmetricDecrypt, symmetricEncrypt } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { accounts, connections, type Platform } from "@/db/schema";
import { getAuthSecretConfig } from "@/lib/auth";
import { ReauthRequiredError, refreshPlatformToken } from "./oauth-refresh";

/** Refresh a bit early so long-running calls don't start with an almost-expired token. */
const REFRESH_WINDOW_MS = 5 * 60 * 1000;

export class ConnectionUnavailableError extends Error {
  constructor(
    readonly connectionId: string,
    message: string,
  ) {
    super(message);
    this.name = "ConnectionUnavailableError";
  }
}

type Connection = typeof connections.$inferSelect;
type Account = typeof accounts.$inferSelect;

/**
 * One in-flight refresh per account. Twitch and X rotate refresh tokens on every use,
 * so two concurrent refreshes would invalidate each other and lock the user out.
 * This only coordinates within one process; multi-instance coordination comes with the worker split.
 */
const inflight = new Map<string, Promise<string>>();

export async function decryptToken(value: string) {
  return symmetricDecrypt({ key: await getAuthSecretConfig(), data: value });
}

async function encryptToken(value: string) {
  return symmetricEncrypt({ key: await getAuthSecretConfig(), data: value });
}

export async function getConnection(connectionId: string) {
  const [row] = await getDb().select().from(connections).where(eq(connections.id, connectionId)).limit(1);
  return row ?? null;
}

/**
 * Returns a valid platform access token for a connection, refreshing it when needed.
 * Throws ConnectionUnavailableError when the connection needs the user to reconnect.
 */
export async function getConnectionAccessToken(connectionId: string): Promise<{ accessToken: string; connection: Connection }> {
  const connection = await getConnection(connectionId);
  if (!connection) {
    throw new ConnectionUnavailableError(connectionId, "Connection not found.");
  }
  if (connection.status === "needs_reauth") {
    throw new ConnectionUnavailableError(connectionId, connection.statusReason ?? "Reconnect this account.");
  }
  const accessToken = await getAccountAccessToken(connection.accountId, connection.platform, connection.id);
  return { accessToken, connection };
}

export async function getAccountAccessToken(accountId: string, platform: Platform, connectionId?: string) {
  const [account] = await getDb().select().from(accounts).where(eq(accounts.id, accountId)).limit(1);
  if (!account?.accessToken) {
    throw new ConnectionUnavailableError(connectionId ?? accountId, "No credentials stored for this account.");
  }
  const expiresAt = account.accessTokenExpiresAt?.getTime();
  if (expiresAt === undefined || expiresAt > Date.now() + REFRESH_WINDOW_MS) {
    return decryptToken(account.accessToken);
  }

  const existing = inflight.get(account.id);
  if (existing) {
    return existing;
  }
  const job = refreshAccount(account, platform, connectionId).finally(() => inflight.delete(account.id));
  inflight.set(account.id, job);
  return job;
}

/** Forces a refresh, e.g. after the platform rejected a token that looked valid. */
export async function forceRefresh(connection: Connection) {
  const [account] = await getDb().select().from(accounts).where(eq(accounts.id, connection.accountId)).limit(1);
  if (!account) {
    throw new ConnectionUnavailableError(connection.id, "Account not found.");
  }
  const existing = inflight.get(account.id);
  if (existing) {
    return existing;
  }
  const job = refreshAccount(account, connection.platform, connection.id).finally(() => inflight.delete(account.id));
  inflight.set(account.id, job);
  return job;
}

async function refreshAccount(account: Account, platform: Platform, connectionId?: string) {
  if (!account.refreshToken) {
    await markNeedsReauth(account.id, "No refresh token stored. Reconnect this account.");
    throw new ConnectionUnavailableError(connectionId ?? account.id, "No refresh token stored.");
  }

  try {
    const refreshed = await refreshPlatformToken(platform, await decryptToken(account.refreshToken));
    await getDb()
      .update(accounts)
      .set({
        accessToken: await encryptToken(refreshed.accessToken),
        refreshToken: refreshed.refreshToken ? await encryptToken(refreshed.refreshToken) : account.refreshToken,
        accessTokenExpiresAt: refreshed.expiresAt,
        ...(refreshed.scopes ? { scope: refreshed.scopes.join(",") } : {}),
      })
      .where(eq(accounts.id, account.id));
    return refreshed.accessToken;
  } catch (error) {
    if (error instanceof ReauthRequiredError) {
      await markNeedsReauth(account.id, error.message);
      throw new ConnectionUnavailableError(connectionId ?? account.id, error.message);
    }
    throw error;
  }
}

export async function markNeedsReauth(accountId: string, reason: string) {
  await getDb()
    .update(connections)
    .set({ status: "needs_reauth", statusReason: reason })
    .where(eq(connections.accountId, accountId));
}
