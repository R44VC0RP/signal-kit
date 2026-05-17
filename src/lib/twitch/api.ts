type TwitchTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope?: string[];
  token_type: string;
};

type TwitchValidateResponse = {
  client_id: string;
  login: string;
  scopes: string[];
  user_id: string;
  expires_in: number;
};

export type TwitchHelixUser = {
  id: string;
  login: string;
  display_name: string;
  email?: string;
  profile_image_url?: string;
};

export type TwitchSubscriptionRequest = {
  type: string;
  version: string;
  condition: Record<string, string>;
  sessionId: string;
};

const TWITCH_ID_BASE = "https://id.twitch.tv/oauth2";
const TWITCH_API_BASE = "https://api.twitch.tv/helix";

export function getTwitchClientId() {
  const clientId = process.env.TWITCH_CLIENT_ID;
  if (!clientId) {
    throw new Error("TWITCH_CLIENT_ID is required.");
  }
  return clientId;
}

function getTwitchClientSecret() {
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  if (!clientSecret) {
    throw new Error("TWITCH_CLIENT_SECRET is required.");
  }
  return clientSecret;
}

export async function exchangeCodeForToken(code: string, redirectUri: string) {
  const body = new URLSearchParams({
    client_id: getTwitchClientId(),
    client_secret: getTwitchClientSecret(),
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });
  return twitchFetch<TwitchTokenResponse>(`${TWITCH_ID_BASE}/token`, { method: "POST", body });
}

export async function refreshTwitchToken(refreshToken: string) {
  const body = new URLSearchParams({
    client_id: getTwitchClientId(),
    client_secret: getTwitchClientSecret(),
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  return twitchFetch<TwitchTokenResponse>(`${TWITCH_ID_BASE}/token`, { method: "POST", body });
}

export async function validateTwitchToken(accessToken: string) {
  return twitchFetch<TwitchValidateResponse>(`${TWITCH_ID_BASE}/validate`, {
    headers: { Authorization: `OAuth ${accessToken}` },
  });
}

export async function getTwitchUser(accessToken: string) {
  const response = await twitchFetch<{ data: TwitchHelixUser[] }>(`${TWITCH_API_BASE}/users`, {
    headers: twitchHeaders(accessToken),
  });
  const user = response.data[0];
  if (!user) {
    throw new Error("Twitch did not return a user profile.");
  }
  return user;
}

export async function createEventSubSubscription(accessToken: string, request: TwitchSubscriptionRequest) {
  return twitchFetch<{ data: Array<{ id: string; status: string; type: string; version: string }> }>(
    `${TWITCH_API_BASE}/eventsub/subscriptions`,
    {
      method: "POST",
      headers: {
        ...twitchHeaders(accessToken),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: request.type,
        version: request.version,
        condition: request.condition,
        transport: {
          method: "websocket",
          session_id: request.sessionId,
        },
      }),
    },
  );
}

function twitchHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Client-Id": getTwitchClientId(),
  };
}

async function twitchFetch<T = unknown>(url: string, init: RequestInit & { allowEmpty?: boolean } = {}) {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Twitch request failed (${response.status}): ${body}`);
  }
  if (init.allowEmpty || response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}
