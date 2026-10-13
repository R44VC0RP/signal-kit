import type { Platform } from "@/db/schema";

export type PlatformProfile = {
  platformUserId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

/** Thrown when the platform rejects the token itself (401), as opposed to a transient failure. */
export class TokenRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TokenRejectedError";
  }
}

export async function fetchPlatformProfile(platform: Platform, accessToken: string): Promise<PlatformProfile> {
  switch (platform) {
    case "twitch": {
      const json = await getJson<{
        data: { id: string; login: string; display_name: string; profile_image_url?: string }[];
      }>("https://api.twitch.tv/helix/users", {
        Authorization: `Bearer ${accessToken}`,
        "Client-Id": process.env.TWITCH_CLIENT_ID ?? "",
      });
      const user = json.data[0];
      if (!user) {
        throw new Error("Twitch did not return a user for this token.");
      }
      return {
        platformUserId: user.id,
        username: user.login,
        displayName: user.display_name,
        avatarUrl: user.profile_image_url ?? null,
      };
    }
    case "youtube": {
      const json = await getJson<{
        items?: {
          id: string;
          snippet?: {
            title?: string;
            customUrl?: string;
            thumbnails?: Record<string, { url?: string } | undefined>;
          };
        }[];
      }>("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", {
        Authorization: `Bearer ${accessToken}`,
      });
      const channel = json.items?.[0];
      if (!channel) {
        throw new Error("This Google account has no YouTube channel.");
      }
      const thumbnails = channel.snippet?.thumbnails ?? {};
      return {
        platformUserId: channel.id,
        username: channel.snippet?.customUrl ?? channel.id,
        displayName: channel.snippet?.title ?? channel.id,
        avatarUrl: thumbnails.high?.url ?? thumbnails.medium?.url ?? thumbnails.default?.url ?? null,
      };
    }
    case "x": {
      const json = await getJson<{
        data: { id: string; username: string; name: string; profile_image_url?: string };
      }>("https://api.x.com/2/users/me?user.fields=profile_image_url", {
        Authorization: `Bearer ${accessToken}`,
      });
      return {
        platformUserId: json.data.id,
        username: json.data.username,
        displayName: json.data.name,
        avatarUrl: json.data.profile_image_url ?? null,
      };
    }
  }
}

async function getJson<T>(url: string, headers: Record<string, string>): Promise<T> {
  const response = await fetch(url, { headers });
  if (response.status === 401) {
    throw new TokenRejectedError(`Token rejected by ${new URL(url).hostname}.`);
  }
  if (!response.ok) {
    throw new Error(`Profile request to ${new URL(url).hostname} failed (${response.status}).`);
  }
  return (await response.json()) as T;
}
