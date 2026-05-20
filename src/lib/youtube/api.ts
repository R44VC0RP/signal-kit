type GoogleTokenResponse = {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type: string;
};

export type YouTubeChannel = {
  id: string;
  snippet?: {
    title?: string;
    customUrl?: string;
    thumbnails?: Record<string, { url?: string }>;
  };
};

export type YouTubeLiveBroadcast = {
  id: string;
  snippet?: {
    title?: string;
    liveChatId?: string;
    scheduledStartTime?: string;
    actualStartTime?: string;
  };
  status?: {
    lifeCycleStatus?: string;
  };
};

export type YouTubeLiveChatMessage = {
  id: string;
  snippet?: {
    type?: string;
    liveChatId?: string;
    authorChannelId?: string;
    publishedAt?: string;
    displayMessage?: string;
    textMessageDetails?: unknown;
    superChatDetails?: unknown;
    superStickerDetails?: unknown;
    pollDetails?: unknown;
    membershipGiftingDetails?: unknown;
    giftMembershipReceivedDetails?: unknown;
    memberMilestoneChatDetails?: unknown;
    userBannedDetails?: unknown;
    messageDeletedDetails?: unknown;
  };
  authorDetails?: {
    channelId?: string;
    channelUrl?: string;
    displayName?: string;
    profileImageUrl?: string;
    isVerified?: boolean;
    isChatOwner?: boolean;
    isChatSponsor?: boolean;
    isChatModerator?: boolean;
  };
};

export type YouTubeLiveChatResponse = {
  nextPageToken?: string;
  pollingIntervalMillis?: number;
  offlineAt?: string;
  items?: YouTubeLiveChatMessage[];
  activePollItem?: YouTubeLiveChatMessage;
};

const GOOGLE_OAUTH_BASE = "https://oauth2.googleapis.com";
const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

export class YouTubeApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: string,
    readonly reason?: string,
  ) {
    super(message);
  }
}

export function getGoogleClientId() {
  const value = process.env.GOOGLE_CLIENT_ID ?? process.env.YOUTUBE_CLIENT_ID;
  if (!value) {
    throw new Error("GOOGLE_CLIENT_ID or YOUTUBE_CLIENT_ID is required.");
  }
  return value;
}

function getGoogleClientSecret() {
  const value = process.env.GOOGLE_CLIENT_SECRET ?? process.env.YOUTUBE_CLIENT_SECRET;
  if (!value) {
    throw new Error("GOOGLE_CLIENT_SECRET or YOUTUBE_CLIENT_SECRET is required.");
  }
  return value;
}

export async function exchangeCodeForGoogleToken(code: string, redirectUri: string) {
  const body = new URLSearchParams({
    client_id: getGoogleClientId(),
    client_secret: getGoogleClientSecret(),
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });
  return googleFetch<GoogleTokenResponse>(`${GOOGLE_OAUTH_BASE}/token`, { method: "POST", body });
}

export async function refreshGoogleToken(refreshToken: string) {
  const body = new URLSearchParams({
    client_id: getGoogleClientId(),
    client_secret: getGoogleClientSecret(),
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  return googleFetch<GoogleTokenResponse>(`${GOOGLE_OAUTH_BASE}/token`, { method: "POST", body });
}

export async function getMyYouTubeChannel(accessToken: string) {
  const url = new URL(`${YOUTUBE_API_BASE}/channels`);
  url.searchParams.set("part", "snippet");
  url.searchParams.set("mine", "true");
  const response = await youtubeFetch<{ items?: YouTubeChannel[] }>(accessToken, url);
  const channel = response.items?.[0];
  if (!channel) {
    throw new Error("YouTube did not return a channel for this Google account.");
  }
  return channel;
}

export async function listActiveLiveBroadcasts(accessToken: string) {
  const url = new URL(`${YOUTUBE_API_BASE}/liveBroadcasts`);
  url.searchParams.set("part", "id,snippet,status");
  url.searchParams.set("broadcastType", "all");
  url.searchParams.set("mine", "true");
  url.searchParams.set("maxResults", "50");
  const response = await youtubeFetch<{ items?: YouTubeLiveBroadcast[] }>(accessToken, url);
  return (response.items ?? []).filter((broadcast) => {
    const status = broadcast.status?.lifeCycleStatus;
    return status === "live" || status === "liveStarting" || status === "testing" || status === "testStarting";
  });
}

export async function listLiveChatMessages(
  accessToken: string,
  liveChatId: string,
  pageToken?: string,
) {
  const url = new URL(`${YOUTUBE_API_BASE}/liveChat/messages`);
  url.searchParams.set("part", "snippet,authorDetails");
  url.searchParams.set("liveChatId", liveChatId);
  url.searchParams.set("maxResults", "200");
  url.searchParams.set("profileImageSize", "88");
  if (pageToken) {
    url.searchParams.set("pageToken", pageToken);
  }
  return youtubeFetch<YouTubeLiveChatResponse>(accessToken, url);
}

function googleFetch<T>(url: string, init: RequestInit) {
  return parseGoogleResponse<T>(fetch(url, init));
}

function youtubeFetch<T>(accessToken: string, url: URL) {
  return parseGoogleResponse<T>(
    fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

async function parseGoogleResponse<T>(promise: Promise<Response>) {
  const response = await promise;
  const body = await response.text();
  if (!response.ok) {
    throw new YouTubeApiError(
      `YouTube request failed (${response.status}): ${body}`,
      response.status,
      body,
      parseGoogleErrorReason(body),
    );
  }
  return JSON.parse(body) as T;
}

function parseGoogleErrorReason(body: string) {
  try {
    const parsed = JSON.parse(body) as {
      error?: { errors?: Array<{ reason?: string }>; status?: string } | string;
    };
    if (typeof parsed.error === "object") {
      return parsed.error.errors?.[0]?.reason ?? parsed.error.status;
    }
    return parsed.error;
  } catch {
    return undefined;
  }
}
