import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAppUrl } from "@/lib/app-url";
import { randomToken } from "@/lib/crypto";
import { getGoogleClientId } from "@/lib/youtube/api";
import { DEFAULT_YOUTUBE_SCOPES } from "@/lib/youtube/scopes";

const YOUTUBE_OAUTH_STATE_COOKIE = "signal_kit_youtube_oauth_state";

export async function GET(request: Request) {
  const appUrl = getAppUrl(request);
  const state = randomToken(24);
  const cookieStore = await cookies();
  cookieStore.set(YOUTUBE_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60,
  });

  const authorizeUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorizeUrl.searchParams.set("client_id", getGoogleClientId());
  authorizeUrl.searchParams.set("redirect_uri", `${appUrl}/api/auth/youtube/callback`);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", DEFAULT_YOUTUBE_SCOPES.join(" "));
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("access_type", "offline");
  authorizeUrl.searchParams.set("prompt", "consent");
  authorizeUrl.searchParams.set("include_granted_scopes", "true");

  return NextResponse.redirect(authorizeUrl);
}
