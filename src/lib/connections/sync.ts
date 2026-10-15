import { randomUUID } from "crypto";
import { and, eq, inArray, notInArray } from "drizzle-orm";
import { getDb } from "@/db";
import { accounts, connections, platformSubscriptions, type ConnectionRole } from "@/db/schema";
import { isAuthProviderId, parseScopes, PROVIDER_PLATFORM, type AuthProviderId } from "@/lib/auth/scopes";
import { connectionEvents } from "./events";
import { fetchPlatformProfile, TokenRejectedError } from "./profiles";
import { ConnectionUnavailableError, forceRefresh, getAccountAccessToken } from "./tokens";

type SyncOptions = {
  /** The OAuth callback that just finished, so its account gets the role the user picked. */
  justLinked?: { providerId: AuthProviderId; role: ConnectionRole };
};

/**
 * Reconciles a user's Better Auth accounts into SignalKit connections.
 * Safe to call repeatedly: accounts unchanged since their last profile sync are skipped,
 * and connections whose account was unlinked are removed.
 */
export async function syncConnectionsForUser(userId: string, options: SyncOptions = {}) {
  const db = getDb();
  const providerIds = Object.keys(PROVIDER_PLATFORM);
  const [userAccounts, userConnections] = await Promise.all([
    db
      .select()
      .from(accounts)
      .where(and(eq(accounts.userId, userId), inArray(accounts.providerId, providerIds))),
    db.select().from(connections).where(eq(connections.userId, userId)),
  ]);

  const justLinkedAccountId = options.justLinked
    ? userAccounts
        .filter((account) => account.providerId === options.justLinked?.providerId)
        .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())[0]?.id
    : undefined;

  for (const account of userAccounts) {
    if (!isAuthProviderId(account.providerId)) {
      continue;
    }
    const existing = userConnections.find((connection) => connection.accountId === account.id);
    const isJustLinked = account.id === justLinkedAccountId;
    const stale = !existing?.profileSyncedAt || account.updatedAt > existing.profileSyncedAt;
    if (existing && !isJustLinked && !stale) {
      continue;
    }

    try {
      await upsertConnection(userId, account, existing, isJustLinked ? options.justLinked?.role : undefined);
    } catch (error) {
      console.error(`[connections] sync failed for account ${account.id} (${account.providerId})`, error);
      if (existing && !(error instanceof ConnectionUnavailableError)) {
        await db
          .update(connections)
          .set({ status: "error", statusReason: errorMessage(error) })
          .where(eq(connections.id, existing.id));
      }
    }
  }

  // Accounts unlinked through Better Auth leave orphaned connections behind.
  const accountIds = userAccounts.map((account) => account.id);
  const orphaned = await db
    .select({ id: connections.id })
    .from(connections)
    .where(
      accountIds.length > 0
        ? and(eq(connections.userId, userId), notInArray(connections.accountId, accountIds))
        : eq(connections.userId, userId),
    );
  for (const { id } of orphaned) {
    await removeConnectionRecords(id);
  }
}

/**
 * Re-reads a connection's profile (name, handle, picture) from the platform. YouTube retention
 * (lib/retention/youtube.ts) calls it weekly for YouTube channels so the stored channel profile
 * is never older than 30 days; if it can't be refreshed by then, the profile is cleared.
 */
export async function refreshConnectionProfile(connectionId: string) {
  const db = getDb();
  const [connection] = await db.select().from(connections).where(eq(connections.id, connectionId)).limit(1);
  const [account] = connection ? await db.select().from(accounts).where(eq(accounts.id, connection.accountId)).limit(1) : [];
  if (!connection || !account) {
    return false;
  }
  await upsertConnection(connection.userId, account, connection, undefined);
  return true;
}

async function upsertConnection(
  userId: string,
  account: typeof accounts.$inferSelect,
  existing: typeof connections.$inferSelect | undefined,
  requestedRole: ConnectionRole | undefined,
) {
  const providerId = account.providerId as AuthProviderId;
  const platform = PROVIDER_PLATFORM[providerId];
  let accessToken = await getAccountAccessToken(account.id, platform, existing?.id);

  let profile;
  try {
    profile = await fetchPlatformProfile(platform, accessToken);
  } catch (error) {
    if (!(error instanceof TokenRejectedError) || !existing) {
      throw error;
    }
    // The stored expiry can be wrong (revoked early); one forced refresh tells us for sure.
    accessToken = await forceRefresh(existing);
    profile = await fetchPlatformProfile(platform, accessToken);
  }

  const scopes = parseScopes(account.scope);
  const role = requestedRole ?? existing?.role ?? inferRole(platform, scopes);
  const now = new Date();
  const values = {
    platformUserId: profile.platformUserId,
    username: profile.username,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    role,
    status: "active" as const,
    statusReason: null,
    scopes,
    profileSyncedAt: now,
    lastValidatedAt: now,
  };

  const db = getDb();
  if (existing) {
    await db.update(connections).set(values).where(eq(connections.id, existing.id));
    connectionEvents.emit("changed", existing.id);
    return existing.id;
  }

  const id = randomUUID();
  try {
    await db.insert(connections).values({ id, userId, accountId: account.id, platform, ...values });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      // Another SignalKit user already connected this channel (possible for YouTube brand
      // channels managed by several Google accounts). Ownership stays with the first user.
      throw new Error(`This ${platform} channel is already connected to another Signal Kit account.`);
    }
    throw error;
  }
  connectionEvents.emit("changed", id);
  return id;
}

/** A Twitch account authorized with only the bot scopes is a chat bot, not a channel. */
function inferRole(platform: string, scopes: string[]): ConnectionRole {
  if (platform === "twitch" && scopes.includes("user:bot") && !scopes.includes("channel:read:subscriptions")) {
    return "bot";
  }
  return "broadcaster";
}

/** Deletes a connection and its subscriptions. Does not touch the Better Auth account. */
export async function removeConnectionRecords(connectionId: string) {
  const db = getDb();
  await db.delete(platformSubscriptions).where(eq(platformSubscriptions.connectionId, connectionId));
  await db.delete(connections).where(eq(connections.id, connectionId));
  connectionEvents.emit("removed", connectionId);
}

function isDuplicateKeyError(error: unknown) {
  const cause = (error as { cause?: { code?: string } })?.cause ?? error;
  return (cause as { code?: string })?.code === "ER_DUP_ENTRY";
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
