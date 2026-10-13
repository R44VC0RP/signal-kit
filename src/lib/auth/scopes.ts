import type { ConnectionRole, Platform } from "@/db/schema";

/** Better Auth provider ids, mapped to SignalKit platforms. */
export const PROVIDER_PLATFORM = {
  twitch: "twitch",
  google: "youtube",
  twitter: "x",
} as const satisfies Record<string, Platform>;

export type AuthProviderId = keyof typeof PROVIDER_PLATFORM;

export function isAuthProviderId(value: unknown): value is AuthProviderId {
  return typeof value === "string" && value in PROVIDER_PLATFORM;
}

// Better Auth's Twitch provider always adds `user:read:email openid` for sign-in.

/** Everything a broadcaster connection needs for EventSub, chat, and broadcast management. */
export const TWITCH_BROADCASTER_SCOPES = [
  "bits:read",
  "channel:bot",
  "channel:manage:broadcast",
  "channel:read:ads",
  "channel:read:charity",
  "channel:read:goals",
  "channel:read:guest_star",
  "channel:read:hype_train",
  "channel:read:polls",
  "channel:read:predictions",
  "channel:read:redemptions",
  "channel:read:subscriptions",
  "channel:read:vips",
  "moderation:read",
  "moderator:read:chat_settings",
  "moderator:read:chatters",
  "moderator:read:followers",
  "moderator:read:shoutouts",
  "user:bot",
  "user:read:chat",
  "user:write:chat",
];

/** A separate Twitch account that reads and sends chat as a bot. */
export const TWITCH_BOT_SCOPES = ["user:bot", "user:read:chat", "user:write:chat"];

/** Reading broadcasts and live chat only needs read access, which has a far milder consent screen. */
export const YOUTUBE_SCOPES = ["https://www.googleapis.com/auth/youtube.readonly"];

/**
 * Sending chat, moderating, or editing broadcast details. Not requested anywhere and not
 * approved for the Google project (removed from Data Access); add it there and go through
 * verification before any feature asks for it.
 */
export const YOUTUBE_WRITE_SCOPE = "https://www.googleapis.com/auth/youtube.force-ssl";

/** Livestream scopes need X allow-listing; request them only once access is granted. */
export const X_LIVESTREAM_SCOPES = ["broadcast.read", "broadcast.write", "follows.read"];

export function xLivestreamEnabled() {
  return process.env.X_LIVESTREAM_ENABLED === "true";
}

export const BOT_CAPABLE_PROVIDERS: AuthProviderId[] = ["twitch"];

export function scopesFor(provider: AuthProviderId, role: ConnectionRole): string[] {
  switch (provider) {
    case "twitch":
      return role === "bot" ? TWITCH_BOT_SCOPES : TWITCH_BROADCASTER_SCOPES;
    case "google":
      return YOUTUBE_SCOPES;
    case "twitter":
      return xLivestreamEnabled() ? X_LIVESTREAM_SCOPES : [];
  }
}

export function parseScopes(scope: string | null | undefined): string[] {
  return (scope ?? "")
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function hasScopes(granted: string[], required: string[]) {
  const set = new Set(granted);
  return required.every((scope) => set.has(scope));
}
