import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { connectedAccounts } from "@/db/schema";
import { getAppUrl } from "@/lib/app-url";
import { encryptSecret, randomToken, safeEqual } from "@/lib/crypto";
import { getCurrentUser } from "@/lib/session";
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

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(`${appUrl}/dashboard?error=auth_required`);
  }

  try {
    const token = await exchangeCodeForGoogleToken(code, `${appUrl}/api/auth/youtube/callback`);
    const channel = await getMyYouTubeChannel(token.access_token);
    const scopes = token.scope?.split(" ").filter(Boolean) ?? [];
    const tokenExpiresAt = token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null;
    const profileImageUrl =
      channel.snippet?.thumbnails?.high?.url ??
      channel.snippet?.thumbnails?.medium?.url ??
      channel.snippet?.thumbnails?.default?.url ??
      null;

    const [existing] = await getDb()
      .select({ id: connectedAccounts.id, refreshTokenEncrypted: connectedAccounts.refreshTokenEncrypted })
      .from(connectedAccounts)
      .where(
        and(
          eq(connectedAccounts.ownerTwitchUserId, user.id),
          eq(connectedAccounts.provider, "youtube"),
          eq(connectedAccounts.providerAccountId, channel.id),
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
        ownerTwitchUserId: user.id,
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
    cookieStore.delete(YOUTUBE_OAUTH_STATE_COOKIE);
    return NextResponse.redirect(`${appUrl}/dashboard?connected=youtube`);
  } catch (error) {
    console.error("[youtube] oauth callback failed", error);
    return NextResponse.redirect(`${appUrl}/dashboard?error=youtube_oauth_failed`);
  }
}
