import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb } from "@/db";
import { appSessions, twitchUsers } from "@/db/schema";
import { randomToken } from "@/lib/crypto";

export const SESSION_COOKIE = "signal_kit_session";
const SESSION_DAYS = 30;

export async function createSession(twitchUserId: string) {
  const id = randomToken(48);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await getDb().insert(appSessions).values({ id, twitchUserId, expiresAt });
  return { id, expiresAt };
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionId) {
    return null;
  }

  const [row] = await getDb()
    .select({ user: twitchUsers })
    .from(appSessions)
    .innerJoin(twitchUsers, eq(appSessions.twitchUserId, twitchUsers.id))
    .where(and(eq(appSessions.id, sessionId), gt(appSessions.expiresAt, new Date())))
    .limit(1);

  return row?.user ?? null;
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
