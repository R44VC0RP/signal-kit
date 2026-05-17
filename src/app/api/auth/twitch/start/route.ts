import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAppUrl } from "@/lib/app-url";
import { randomToken } from "@/lib/crypto";
import { getTwitchClientId } from "@/lib/twitch/api";
import { DEFAULT_TWITCH_SCOPES } from "@/lib/twitch/scopes";

export async function GET(request: Request) {
  const state = randomToken(32);
  const appUrl = getAppUrl(request);
  const redirectUri = `${appUrl}/api/auth/twitch/callback`;
  const authorizeUrl = new URL("https://id.twitch.tv/oauth2/authorize");
  authorizeUrl.searchParams.set("client_id", getTwitchClientId());
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", DEFAULT_TWITCH_SCOPES.join(" "));
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("force_verify", "true");

  const cookieStore = await cookies();
  cookieStore.set("signal_kit_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 10 * 60,
    path: "/",
  });

  return NextResponse.redirect(authorizeUrl);
}
