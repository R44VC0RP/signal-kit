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

export type TwitchChannelInformation = {
  broadcaster_id: string;
  broadcaster_login: string;
  broadcaster_name: string;
  broadcaster_language: string;
  game_id: string;
  game_name: string;
  title: string;
  delay?: number;
  tags?: string[];
  content_classification_labels?: string[];
  is_branded_content?: boolean;
};

export type TwitchCategory = {
  id: string;
  name: string;
  box_art_url: string;
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

export async function getChannelInformation(accessToken: string, broadcasterId: string) {
  const url = new URL(`${TWITCH_API_BASE}/channels`);
  url.searchParams.set("broadcaster_id", broadcasterId);
  const response = await twitchFetch<{ data: TwitchChannelInformation[] }>(url.toString(), {
    headers: twitchHeaders(accessToken),
  });
  return response.data[0] ?? null;
}

export async function modifyChannelInformation(
  accessToken: string,
  broadcasterId: string,
  body: { title?: string; game_id?: string; broadcaster_language?: string; tags?: string[] },
) {
  const url = new URL(`${TWITCH_API_BASE}/channels`);
  url.searchParams.set("broadcaster_id", broadcasterId);
  return twitchFetch<void>(url.toString(), {
    method: "PATCH",
    headers: {
      ...twitchHeaders(accessToken),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    allowEmpty: true,
  });
}

export async function searchTwitchCategories(accessToken: string, query: string) {
  const url = new URL(`${TWITCH_API_BASE}/search/categories`);
  url.searchParams.set("query", query);
  url.searchParams.set("first", "20");
  const response = await twitchFetch<{ data: TwitchCategory[] }>(url.toString(), {
    headers: twitchHeaders(accessToken),
  });
  return response.data;
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
