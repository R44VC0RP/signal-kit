import type { Platform } from "@/db/schema";

export type RefreshedTokens = {
  accessToken: string;
  /** Present when the platform rotated the refresh token (Twitch and X always do). */
  refreshToken?: string;
  expiresAt: Date | null;
  scopes?: string[];
};

/** The grant is gone (revoked, expired, or password changed). Only the user can fix it by reconnecting. */
export class ReauthRequiredError extends Error {
  constructor(
    readonly platform: Platform,
    message: string,
  ) {
    super(message);
    this.name = "ReauthRequiredError";
  }
}

const TOKEN_ENDPOINTS: Record<Platform, string> = {
  twitch: "https://id.twitch.tv/oauth2/token",
  youtube: "https://oauth2.googleapis.com/token",
  x: "https://api.x.com/2/oauth2/token",
};

function clientCredentials(platform: Platform) {
  const [idVar, secretVar] =
    platform === "twitch"
      ? ["TWITCH_CLIENT_ID", "TWITCH_CLIENT_SECRET"]
      : platform === "youtube"
        ? ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"]
        : ["X_CLIENT_ID", "X_CLIENT_SECRET"];
  const clientId = process.env[idVar];
  const clientSecret = process.env[secretVar];
  if (!clientId || !clientSecret) {
    throw new Error(`${idVar} and ${secretVar} are required.`);
  }
  return { clientId, clientSecret };
}

/**
 * Exchanges a refresh token for a new access token.
 * Throws ReauthRequiredError when the platform rejects the grant, and a plain Error for
 * transient failures (network, 5xx) so callers can retry without disconnecting the user.
 */
export async function refreshPlatformToken(platform: Platform, refreshToken: string): Promise<RefreshedTokens> {
  const { clientId, clientSecret } = clientCredentials(platform);
  const body = new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken });
  const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };

  if (platform === "x") {
    // X confidential clients authenticate with HTTP Basic.
    headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
  } else {
    body.set("client_id", clientId);
    body.set("client_secret", clientSecret);
  }

  const response = await fetch(TOKEN_ENDPOINTS[platform], { method: "POST", headers, body });
  const text = await response.text();

  // 400 means the grant itself was rejected. Client misconfiguration (invalid_client, 401/403)
  // is our problem, not the user's, so it must not push every connection into needs_reauth.
  if (response.status === 400 && !text.includes("invalid_client")) {
    throw new ReauthRequiredError(platform, `Token refresh rejected: ${summarize(text)}`);
  }
  if (!response.ok) {
    throw new Error(`${platform} token refresh failed (${response.status}): ${summarize(text)}`);
  }

  const json = JSON.parse(text) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string | string[];
  };
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: json.expires_in ? new Date(Date.now() + json.expires_in * 1000) : null,
    scopes: Array.isArray(json.scope) ? json.scope : json.scope?.split(" ").filter(Boolean),
  };
}

/** Error bodies can echo request data; keep logs and stored reasons short. */
function summarize(text: string) {
  try {
    const json = JSON.parse(text) as { error?: string; message?: string; error_description?: string };
    return [json.error, json.message ?? json.error_description].filter(Boolean).join(": ") || "unknown error";
  } catch {
    return text.slice(0, 200);
  }
}
