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
    description?: string;
    liveChatId?: string;
    scheduledStartTime?: string;
    actualStartTime?: string;
  };
  status?: {
    lifeCycleStatus?: string;
  };
};

export type YouTubeVideo = {
  id: string;
  snippet?: {
    title?: string;
    description?: string;
    categoryId?: string;
    tags?: string[];
    defaultLanguage?: string;
  };
  status?: {
    privacyStatus?: "public" | "unlisted" | "private";
    embeddable?: boolean;
    license?: string;
    publicStatsViewable?: boolean;
    selfDeclaredMadeForKids?: boolean;
    containsSyntheticMedia?: boolean;
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
  const broadcasts = await listOwnedLiveBroadcasts(accessToken);
  return broadcasts.filter((broadcast) => {
    const status = broadcast.status?.lifeCycleStatus;
    return status === "live" || status === "liveStarting" || status === "testing" || status === "testStarting";
  });
}

export async function listOwnedLiveBroadcasts(accessToken: string) {
  const url = new URL(`${YOUTUBE_API_BASE}/liveBroadcasts`);
  url.searchParams.set("part", "id,snippet,status");
  url.searchParams.set("broadcastType", "all");
  url.searchParams.set("mine", "true");
  url.searchParams.set("maxResults", "50");
  const response = await youtubeFetch<{ items?: YouTubeLiveBroadcast[] }>(accessToken, url);
  return response.items ?? [];
}

export async function getVideo(accessToken: string, videoId: string) {
  const url = new URL(`${YOUTUBE_API_BASE}/videos`);
  url.searchParams.set("part", "snippet,status");
  url.searchParams.set("id", videoId);
  const response = await youtubeFetch<{ items?: YouTubeVideo[] }>(accessToken, url);
  return response.items?.[0] ?? null;
}

export async function updateVideo(
  accessToken: string,
  video: YouTubeVideo,
  updates: {
    title?: string;
    description?: string;
    categoryId?: string;
    privacyStatus?: "public" | "unlisted" | "private";
  },
) {
  const part = ["snippet"];
  if (updates.privacyStatus) {
    part.push("status");
  }

  const body: YouTubeVideo = {
    id: video.id,
    snippet: {
      title: updates.title ?? video.snippet?.title ?? "Untitled broadcast",
      description: updates.description ?? video.snippet?.description ?? "",
      categoryId: updates.categoryId ?? video.snippet?.categoryId ?? "20",
      ...(video.snippet?.tags ? { tags: video.snippet.tags } : {}),
      ...(video.snippet?.defaultLanguage ? { defaultLanguage: video.snippet.defaultLanguage } : {}),
    },
  };

  if (updates.privacyStatus) {
    body.status = {
      privacyStatus: updates.privacyStatus,
      ...(typeof video.status?.embeddable === "boolean" ? { embeddable: video.status.embeddable } : {}),
      ...(video.status?.license ? { license: video.status.license } : {}),
      ...(typeof video.status?.publicStatsViewable === "boolean"
        ? { publicStatsViewable: video.status.publicStatsViewable }
        : {}),
      ...(typeof video.status?.selfDeclaredMadeForKids === "boolean"
        ? { selfDeclaredMadeForKids: video.status.selfDeclaredMadeForKids }
        : {}),
      ...(typeof video.status?.containsSyntheticMedia === "boolean"
        ? { containsSyntheticMedia: video.status.containsSyntheticMedia }
        : {}),
    };
  }

  const url = new URL(`${YOUTUBE_API_BASE}/videos`);
  url.searchParams.set("part", part.join(","));
  return youtubeFetch<YouTubeVideo>(accessToken, url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
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

function youtubeFetch<T>(accessToken: string, url: URL, init: RequestInit = {}) {
  return parseGoogleResponse<T>(
    fetch(url, {
      ...init,
      headers: { Authorization: `Bearer ${accessToken}`, ...init.headers },
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
