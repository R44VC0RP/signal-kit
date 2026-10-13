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

const TWITCH_API_BASE = "https://api.twitch.tv/helix";

export function getTwitchClientId() {
  const clientId = process.env.TWITCH_CLIENT_ID;
  if (!clientId) {
    throw new Error("TWITCH_CLIENT_ID is required.");
  }
  return clientId;
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
