import { and, eq, or } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { connectedAccounts } from "@/db/schema";
import { getAppUrl } from "@/lib/app-url";
import { ensureAppUser, findAppUserIdForConnectedAccount } from "@/lib/auth/app-users";
import { encryptSecret, randomToken, safeEqual } from "@/lib/crypto";
import { createSession, getCurrentUser, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";
import { exchangeCodeForGoogleToken, getMyYouTubeChannel } from "@/lib/youtube/api";
import { youtubeLiveManager } from "@/lib/youtube/live-manager";

const YOUTUBE_OAUTH_STATE_COOKIE = "signal_kit_youtube_oauth_state";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(YOUTUBE_OAUTH_STATE_COOKIE)?.value;
  const appUrl = getAppUrl(request);

  if (!code || !state || !expectedState || !safeEqual(state, expectedState)) {
    return NextResponse.redirect(`${appUrl}/dashboard?error=youtube_oauth_state`);
  }

  try {
    const user = await getCurrentUser();
    const token = await exchangeCodeForGoogleToken(code, `${appUrl}/api/auth/youtube/callback`);
    const channel = await getMyYouTubeChannel(token.access_token);
    const scopes = token.scope?.split(" ").filter(Boolean) ?? [];
    const tokenExpiresAt = token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null;
    const profileImageUrl =
      channel.snippet?.thumbnails?.high?.url ??
      channel.snippet?.thumbnails?.medium?.url ??
      channel.snippet?.thumbnails?.default?.url ??
      null;
    const appUserId = await ensureAppUser({
      id: user?.id ?? (await findAppUserIdForConnectedAccount("youtube", channel.id)),
      displayName: user?.displayName ?? channel.snippet?.title ?? channel.id,
      profileImageUrl: user?.profileImageUrl ?? profileImageUrl,
      primaryProvider: user?.primaryProvider ?? "youtube",
    });

    const [existing] = await getDb()
      .select({ id: connectedAccounts.id, refreshTokenEncrypted: connectedAccounts.refreshTokenEncrypted })
      .from(connectedAccounts)
      .where(
        and(
          eq(connectedAccounts.provider, "youtube"),
          or(eq(connectedAccounts.providerAccountId, channel.id), eq(connectedAccounts.appUserId, appUserId)),
        ),
      )
      .limit(1);

    const refreshTokenEncrypted = token.refresh_token
      ? encryptSecret(token.refresh_token)
      : existing?.refreshTokenEncrypted;
    if (!refreshTokenEncrypted) {
      return NextResponse.redirect(`${appUrl}/dashboard?error=youtube_refresh_token`);
    }

    const accountId = existing?.id ?? randomToken(24);
    await getDb()
      .insert(connectedAccounts)
      .values({
        id: accountId,
        appUserId,
        ownerTwitchUserId: user?.twitchUserId ?? null,
        provider: "youtube",
        providerAccountId: channel.id,
        login: channel.snippet?.customUrl ?? channel.snippet?.title ?? channel.id,
        displayName: channel.snippet?.title ?? channel.id,
        profileImageUrl,
        accessTokenEncrypted: encryptSecret(token.access_token),
        refreshTokenEncrypted,
        tokenExpiresAt,
        scopes,
        lastError: null,
      })
      .onDuplicateKeyUpdate({
        set: {
          login: channel.snippet?.customUrl ?? channel.snippet?.title ?? channel.id,
          appUserId,
          ownerTwitchUserId: user?.twitchUserId ?? null,
          providerAccountId: channel.id,
          displayName: channel.snippet?.title ?? channel.id,
          profileImageUrl,
          accessTokenEncrypted: encryptSecret(token.access_token),
          refreshTokenEncrypted,
          tokenExpiresAt,
          scopes,
          lastError: null,
        },
      });

    await youtubeLiveManager.ensureAccount(accountId);
    const session = await createSession(appUserId, user?.twitchUserId);
    cookieStore.delete(YOUTUBE_OAUTH_STATE_COOKIE);
    cookieStore.set(SESSION_COOKIE, session.id, sessionCookieOptions(session.expiresAt));
    return NextResponse.redirect(`${appUrl}/dashboard?connected=youtube`);
  } catch (error) {
    console.error("[youtube] oauth callback failed", error);
    return NextResponse.redirect(`${appUrl}/dashboard?error=youtube_oauth_failed`);
  }
}
