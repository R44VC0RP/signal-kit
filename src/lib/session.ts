import { and, eq, gt, or } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb } from "@/db";
import { appSessions, appUsers, twitchUsers } from "@/db/schema";
import { randomToken } from "@/lib/crypto";

export const SESSION_COOKIE = "signal_kit_session";
const SESSION_DAYS = 30;

export type CurrentUser = {
  id: string;
  displayName: string;
  profileImageUrl: string | null;
  primaryProvider: string;
  twitchUserId: string | null;
  twitchLogin: string | null;
  twitchDisplayName: string | null;
  twitchProfileImageUrl: string | null;
  twitchScopes: string[];
};

export async function createSession(appUserId: string, twitchUserId?: string | null) {
  const id = randomToken(48);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await getDb().insert(appSessions).values({ id, appUserId, twitchUserId, expiresAt });
  return { id, expiresAt };
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionId) {
    return null;
  }

  const [session] = await getDb()
    .select()
    .from(appSessions)
    .where(and(eq(appSessions.id, sessionId), gt(appSessions.expiresAt, new Date())))
    .limit(1);

  if (!session) {
    return null;
  }

  const appUserId = session.appUserId ?? session.twitchUserId;
  if (!appUserId) {
    return null;
  }

  const [appUser] = await getDb().select().from(appUsers).where(eq(appUsers.id, appUserId)).limit(1);
  const [twitchUser] = await getDb()
    .select()
    .from(twitchUsers)
    .where(
      session.twitchUserId
        ? or(eq(twitchUsers.appUserId, appUserId), eq(twitchUsers.id, session.twitchUserId))
        : eq(twitchUsers.appUserId, appUserId),
    )
    .limit(1);

  if (!appUser && !twitchUser) {
    return null;
  }

  return {
    id: appUser?.id ?? appUserId,
    displayName: appUser?.displayName ?? twitchUser?.displayName ?? "Signal Kit user",
    profileImageUrl: appUser?.profileImageUrl ?? twitchUser?.profileImageUrl ?? null,
    primaryProvider: appUser?.primaryProvider ?? "twitch",
    twitchUserId: twitchUser?.id ?? session.twitchUserId ?? null,
    twitchLogin: twitchUser?.login ?? null,
    twitchDisplayName: twitchUser?.displayName ?? null,
    twitchProfileImageUrl: twitchUser?.profileImageUrl ?? null,
    twitchScopes: twitchUser?.scopes ?? [],
  };
}

export async function destroyCurrentSession() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (sessionId) {
    await getDb().delete(appSessions).where(eq(appSessions.id, sessionId));
  }
}

export function sessionCookieOptions(expiresAt?: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  };
}
