import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { twitchUsers } from "@/db/schema";
import { getAppUrl } from "@/lib/app-url";
import { ensureAppUser, findAppUserIdForTwitch } from "@/lib/auth/app-users";
import { encryptSecret, safeEqual } from "@/lib/crypto";
import { createSession, getCurrentUser, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";
import { exchangeCodeForToken, getTwitchUser, validateTwitchToken } from "@/lib/twitch/api";
import { syncDesiredSubscriptionsForUser } from "@/lib/twitch/subscriptions";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("signal_kit_oauth_state")?.value;

  if (!code || !state || !expectedState || !safeEqual(state, expectedState)) {
    return NextResponse.redirect(`${getAppUrl(request)}/dashboard?error=oauth_state`);
  }

  const appUrl = getAppUrl(request);
  const token = await exchangeCodeForToken(code, `${appUrl}/api/auth/twitch/callback`);
  const [profile, validation] = await Promise.all([
    getTwitchUser(token.access_token),
    validateTwitchToken(token.access_token),
  ]);

  const scopes = validation.scopes ?? token.scope ?? [];
  const tokenExpiresAt = new Date(Date.now() + token.expires_in * 1000);
  const currentUser = await getCurrentUser();
  const appUserId = await ensureAppUser({
    id: currentUser?.id ?? (await findAppUserIdForTwitch(profile.id)) ?? profile.id,
    displayName: currentUser?.displayName ?? profile.display_name,
    profileImageUrl: currentUser?.profileImageUrl ?? profile.profile_image_url,
    primaryProvider: currentUser?.primaryProvider ?? "twitch",
  });

  await getDb()
    .insert(twitchUsers)
    .values({
      id: profile.id,
      appUserId,
      login: profile.login,
      displayName: profile.display_name,
      email: profile.email,
      profileImageUrl: profile.profile_image_url,
      accessTokenEncrypted: encryptSecret(token.access_token),
      refreshTokenEncrypted: encryptSecret(token.refresh_token),
      tokenExpiresAt,
      scopes,
    })
    .onDuplicateKeyUpdate({
      set: {
        login: profile.login,
        appUserId,
        displayName: profile.display_name,
        email: profile.email,
        profileImageUrl: profile.profile_image_url,
        accessTokenEncrypted: encryptSecret(token.access_token),
        refreshTokenEncrypted: encryptSecret(token.refresh_token),
        tokenExpiresAt,
        scopes,
      },
    });

  await syncDesiredSubscriptionsForUser(profile.id);
  const session = await createSession(appUserId, profile.id);
  cookieStore.delete("signal_kit_oauth_state");
  cookieStore.set(SESSION_COOKIE, session.id, sessionCookieOptions(session.expiresAt));

  return NextResponse.redirect(`${appUrl}/dashboard?connected=1`);
}
