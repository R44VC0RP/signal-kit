export const DEFAULT_TWITCH_SCOPES = [
  "bits:read",
  "channel:bot",
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
  "user:read:email",
];

export function hasScopes(grantedScopes: string[], requiredScopes: string[]) {
  const granted = new Set(grantedScopes);
  return requiredScopes.every((scope) => granted.has(scope));
}
