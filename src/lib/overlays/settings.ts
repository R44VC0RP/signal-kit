/**
 * Overlay types and their settings. Shared by the customizer, the API and the overlay page,
 * so it must stay free of server-only imports.
 */

export type OverlayType = "alerts" | "chat" | "events";
export type OverlayStyle = "signal" | "clean" | "bold";
export type PlatformFilter = { twitch: boolean; youtube: boolean; x: boolean };

/** Events an alert or event-list overlay can show. */
export const ALERT_KINDS = ["follow", "subscription", "subscription.gift", "tip", "raid", "redemption"] as const;
export type AlertKind = (typeof ALERT_KINDS)[number];

export const ALERT_KIND_LABEL: Record<AlertKind, string> = {
  follow: "Follows",
  subscription: "Subs & memberships",
  "subscription.gift": "Gift subs",
  tip: "Tips, Bits & Super Chats",
  raid: "Raids",
  redemption: "Channel point redemptions",
};

export type AlertSettings = {
  style: OverlayStyle;
  kinds: Record<AlertKind, boolean>;
  platforms: PlatformFilter;
  position: "top" | "center" | "bottom";
  durationSec: number;
  showMessage: boolean;
  showAvatar: boolean;
  sound: boolean;
  volume: number;
  /** Tips below this amount (in the tip's own units: dollars, Bits) don't alert. */
  minTip: number;
  scale: number;
};

export type ChatSettings = {
  style: OverlayStyle;
  platforms: PlatformFilter;
  showAvatars: boolean;
  showPlatform: boolean;
  showBadges: boolean;
  hideCommands: boolean;
  /** Seconds before a message fades out; 0 keeps messages until they scroll off. */
  lifetimeSec: number;
  maxMessages: number;
  scale: number;
};

export type EventListSettings = {
  style: OverlayStyle;
  kinds: Record<AlertKind, boolean>;
  platforms: PlatformFilter;
  showAvatars: boolean;
  maxItems: number;
  scale: number;
};

export type SettingsFor<T extends OverlayType> = T extends "alerts" ? AlertSettings : T extends "chat" ? ChatSettings : EventListSettings;
export type AnySettings = AlertSettings | ChatSettings | EventListSettings;

const ALL_PLATFORMS: PlatformFilter = { twitch: true, youtube: true, x: true };
const ALL_KINDS = Object.fromEntries(ALERT_KINDS.map((kind) => [kind, true])) as Record<AlertKind, boolean>;

export const OVERLAY_TYPES: {
  type: OverlayType;
  name: string;
  description: string;
  /** Recommended browser-source size. */
  width: number;
  height: number;
}[] = [
  { type: "alerts", name: "Alerts", description: "Full-screen notifications for follows, subs, tips, raids and redemptions.", width: 1920, height: 1080 },
  { type: "chat", name: "Chat", description: "Twitch, YouTube and X chat in one box, with avatars and platform logos.", width: 420, height: 720 },
  { type: "events", name: "Event list", description: "A running list of your latest follows, subs, tips and raids.", width: 360, height: 480 },
];

export function overlayTypeInfo(type: OverlayType) {
  return OVERLAY_TYPES.find((info) => info.type === type)!;
}

export function defaultSettings<T extends OverlayType>(type: T): SettingsFor<T> {
  if (type === "alerts") {
    return {
      style: "signal",
      kinds: { ...ALL_KINDS },
      platforms: { ...ALL_PLATFORMS },
      position: "top",
      durationSec: 6,
      showMessage: true,
      showAvatar: true,
      sound: true,
      volume: 0.6,
      minTip: 0,
      scale: 1,
    } satisfies AlertSettings as SettingsFor<T>;
  }
  if (type === "chat") {
    return {
      style: "signal",
      platforms: { ...ALL_PLATFORMS },
      showAvatars: true,
      showPlatform: true,
      showBadges: true,
      hideCommands: true,
      lifetimeSec: 0,
      maxMessages: 30,
      scale: 1,
    } satisfies ChatSettings as SettingsFor<T>;
  }
  return {
    style: "signal",
    kinds: { ...ALL_KINDS },
    platforms: { ...ALL_PLATFORMS },
    showAvatars: true,
    maxItems: 6,
    scale: 1,
  } satisfies EventListSettings as SettingsFor<T>;
}

/**
 * Accepts untrusted input (API bodies, stored JSON from older versions) and returns complete,
 * valid settings: unknown keys are dropped, wrong types fall back to the default, numbers clamp.
 */
export function sanitizeSettings<T extends OverlayType>(type: T, input: unknown): SettingsFor<T> {
  const base = defaultSettings(type) as Record<string, unknown>;
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, fallback] of Object.entries(base)) {
    const value = raw[key];
    if (typeof fallback === "boolean") {
      out[key] = typeof value === "boolean" ? value : fallback;
    } else if (typeof fallback === "number") {
      out[key] = typeof value === "number" && Number.isFinite(value) ? clamp(key, value) : fallback;
    } else if (typeof fallback === "string") {
      out[key] = typeof value === "string" && ALLOWED_STRINGS[key]?.includes(value) ? value : fallback;
    } else if (fallback && typeof fallback === "object") {
      const nested = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
      out[key] = Object.fromEntries(
        Object.entries(fallback as Record<string, boolean>).map(([nestedKey, nestedFallback]) => [
          nestedKey,
          typeof nested[nestedKey] === "boolean" ? nested[nestedKey] : nestedFallback,
        ]),
      );
    }
  }
  return out as SettingsFor<T>;
}

const ALLOWED_STRINGS: Record<string, string[]> = {
  style: ["signal", "clean", "bold"],
  position: ["top", "center", "bottom"],
};

const RANGES: Record<string, [number, number]> = {
  durationSec: [2, 30],
  volume: [0, 1],
  minTip: [0, 100_000],
  scale: [0.6, 2],
  lifetimeSec: [0, 600],
  maxMessages: [5, 100],
  maxItems: [1, 20],
};

function clamp(key: string, value: number) {
  const [min, max] = RANGES[key] ?? [-Infinity, Infinity];
  return Math.min(max, Math.max(min, value));
}

export function isOverlayType(value: unknown): value is OverlayType {
  return value === "alerts" || value === "chat" || value === "events";
}
