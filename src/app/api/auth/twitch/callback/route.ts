import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { twitchUsers } from "@/db/schema";
import { getAppUrl } from "@/lib/app-url";
import { encryptSecret, safeEqual } from "@/lib/crypto";
import { createSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";
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
  await getDb()
    .insert(twitchUsers)
    .values({
      id: profile.id,
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
  const session = await createSession(profile.id);
  cookieStore.delete("signal_kit_oauth_state");
  cookieStore.set(SESSION_COOKIE, session.id, sessionCookieOptions(session.expiresAt));

  return NextResponse.redirect(`${appUrl}/dashboard?connected=1`);
}
