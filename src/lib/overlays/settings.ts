/**
 * Overlay types and their settings. Shared by the customizer, the API and the overlay page,
 * so it must stay free of server-only imports.
 */

export type OverlayType = "alerts" | "chat" | "events";
export type OverlayStyle = "signal" | "clean" | "bold";
export type AlertAnimation = "slide" | "fade" | "pop" | "none";
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

/** Words a streamer can use in alert text. */
export const TEMPLATE_VARIABLES = ["name", "amount", "count", "months", "tier", "viewers", "reward", "platform", "message"] as const;

/** Per-kind alert content: the small label, the headline, an optional image/GIF and sound. */
export type AlertTemplate = { enabled: boolean; label: string; title: string; image: string; sound: string };

/** Fonts the overlay can load (Google Fonts, plus the two brand fonts that are always loaded). */
export const FONTS: { id: string; name: string; family: string; google?: string }[] = [
  { id: "hubot", name: "Hubot Sans", family: "var(--font-hubot), sans-serif" },
  { id: "mona", name: "Mona Sans", family: "var(--font-mona), sans-serif" },
  { id: "geist", name: "Geist", family: "'Geist', sans-serif", google: "Geist:wght@400;500;600;700;800" },
  { id: "bricolage", name: "Bricolage Grotesque", family: "'Bricolage Grotesque', sans-serif", google: "Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800" },
  { id: "inter", name: "Inter", family: "'Inter', sans-serif", google: "Inter:wght@400;600;800" },
  { id: "poppins", name: "Poppins", family: "'Poppins', sans-serif", google: "Poppins:wght@400;600;800" },
  { id: "montserrat", name: "Montserrat", family: "'Montserrat', sans-serif", google: "Montserrat:wght@400;600;800" },
  { id: "outfit", name: "Outfit", family: "'Outfit', sans-serif", google: "Outfit:wght@400;600;800" },
  { id: "space-grotesk", name: "Space Grotesk", family: "'Space Grotesk', sans-serif", google: "Space+Grotesk:wght@400;600;700" },
  { id: "nunito", name: "Nunito", family: "'Nunito', sans-serif", google: "Nunito:wght@400;700;900" },
  { id: "fredoka", name: "Fredoka", family: "'Fredoka', sans-serif", google: "Fredoka:wght@400;600;700" },
  { id: "oswald", name: "Oswald", family: "'Oswald', sans-serif", google: "Oswald:wght@400;600;700" },
  { id: "bebas", name: "Bebas Neue", family: "'Bebas Neue', sans-serif", google: "Bebas+Neue" },
  { id: "bangers", name: "Bangers", family: "'Bangers', cursive", google: "Bangers" },
  { id: "lilita", name: "Lilita One", family: "'Lilita One', cursive", google: "Lilita+One" },
  { id: "playfair", name: "Playfair Display", family: "'Playfair Display', serif", google: "Playfair+Display:wght@400;700;900" },
  { id: "jetbrains", name: "JetBrains Mono", family: "'JetBrains Mono', monospace", google: "JetBrains+Mono:wght@400;600;800" },
  { id: "press-start", name: "Press Start 2P", family: "'Press Start 2P', monospace", google: "Press+Start+2P" },
];

export function fontStack(id: string) {
  return (FONTS.find((font) => font.id === id) ?? FONTS[0]).family;
}

export function googleFontsUrl(ids: string[]) {
  const families = [...new Set(ids)].map((id) => FONTS.find((font) => font.id === id)?.google).filter(Boolean);
  return families.length ? `https://fonts.googleapis.com/css2?${families.map((family) => `family=${family}`).join("&")}&display=swap` : null;
}

/** Colours, type and shape shared by every overlay type. */
export type Appearance = {
  style: OverlayStyle;
  font: string;
  textColor: string;
  accentColor: string;
  panelColor: string;
  panelOpacity: number;
  /** Corner radius in px at 100% size. */
  radius: number;
  scale: number;
  /** Extra CSS for power users, applied last. */
  customCss: string;
};

export const POSITIONS = ["top-left", "top", "top-right", "left", "center", "right", "bottom-left", "bottom", "bottom-right"] as const;
export type Position = (typeof POSITIONS)[number];

export type AlertSettings = Appearance & {
  templates: Record<AlertKind, AlertTemplate>;
  platforms: PlatformFilter;
  position: Position;
  animation: AlertAnimation;
  durationSec: number;
  showMessage: boolean;
  showAvatar: boolean;
  sound: boolean;
  volume: number;
  /** Tips below this amount (in the tip's own units: dollars, Bits) don't alert. */
  minTip: number;
  /** Raids with fewer viewers don't alert. */
  minRaid: number;
  /** Comma-separated words; a message containing one is hidden from the alert. */
  blockedWords: string;
};

export type ChatSettings = Appearance & {
  platforms: PlatformFilter;
  showAvatars: boolean;
  showPlatform: boolean;
  showBadges: boolean;
  hideCommands: boolean;
  /** Hide well-known chat bots (Nightbot, StreamElements, …). */
  hideBots: boolean;
  /** Also show tips and subs in the chat, highlighted. */
  showTips: boolean;
  showSubs: boolean;
  /** Name colour: the viewer's own colour (Twitch, else a stable colour), or the accent for everyone. */
  nameColor: "accent" | "viewer";
  newestAt: "bottom" | "top";
  /** Seconds before a message fades out; 0 keeps messages until they scroll off. */
  lifetimeSec: number;
  maxMessages: number;
  /** Comma-separated words; messages containing one never show. */
  blockedWords: string;
};

export type EventListSettings = Appearance & {
  kinds: Record<AlertKind, boolean>;
  platforms: PlatformFilter;
  showAvatars: boolean;
  maxItems: number;
};

export type SettingsFor<T extends OverlayType> = T extends "alerts" ? AlertSettings : T extends "chat" ? ChatSettings : EventListSettings;
export type AnySettings = AlertSettings | ChatSettings | EventListSettings;

/** Picking a style preset applies its colours; everything stays editable afterwards. */
export const STYLE_PRESETS: Record<OverlayStyle, Pick<Appearance, "textColor" | "accentColor" | "panelColor" | "panelOpacity" | "radius" | "font">> = {
  // Browser sources can't blur what's behind them, so panels rely on opacity for legibility.
  signal: { textColor: "#f5f5f5", accentColor: "#3d6bff", panelColor: "#0c0c0c", panelOpacity: 0.84, radius: 18, font: "hubot" },
  clean: { textColor: "#ffffff", accentColor: "#2f5df5", panelColor: "#000000", panelOpacity: 0, radius: 0, font: "geist" },
  bold: { textColor: "#0a0a0a", accentColor: "#2f5df5", panelColor: "#ffffff", panelOpacity: 1, radius: 22, font: "bricolage" },
};

const ALL_PLATFORMS: PlatformFilter = { twitch: true, youtube: true, x: true };
const ALL_KINDS = Object.fromEntries(ALERT_KINDS.map((kind) => [kind, true])) as Record<AlertKind, boolean>;

export const DEFAULT_TEMPLATES: Record<AlertKind, AlertTemplate> = {
  follow: { enabled: true, label: "New follower", title: "{name} followed", image: "", sound: "" },
  subscription: { enabled: true, label: "New subscriber", title: "{name} subscribed", image: "", sound: "" },
  "subscription.gift": { enabled: true, label: "Gift subs", title: "{name} gifted {count} subs", image: "", sound: "" },
  tip: { enabled: true, label: "Tip", title: "{name} sent {amount}", image: "", sound: "" },
  raid: { enabled: true, label: "Raid", title: "{name} is raiding with {viewers} viewers", image: "", sound: "" },
  redemption: { enabled: true, label: "Redemption", title: "{name} redeemed {reward}", image: "", sound: "" },
};

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
  { type: "events", name: "Event list", description: "A running list of your latest follows, subs, tips and raids.", width: 400, height: 500 },
];

export function overlayTypeInfo(type: OverlayType) {
  return OVERLAY_TYPES.find((info) => info.type === type)!;
}

function appearance(): Appearance {
  return { style: "signal", ...STYLE_PRESETS.signal, scale: 1, customCss: "" };
}

export function defaultSettings<T extends OverlayType>(type: T): SettingsFor<T> {
  if (type === "alerts") {
    return {
      ...appearance(),
      templates: structuredClone(DEFAULT_TEMPLATES),
      platforms: { ...ALL_PLATFORMS },
      position: "top",
      animation: "slide",
      durationSec: 6,
      showMessage: true,
      showAvatar: true,
      sound: true,
      volume: 0.6,
      minTip: 0,
      minRaid: 0,
      blockedWords: "",
    } satisfies AlertSettings as SettingsFor<T>;
  }
  if (type === "chat") {
    return {
      ...appearance(),
      platforms: { ...ALL_PLATFORMS },
      showAvatars: true,
      showPlatform: true,
      showBadges: true,
      hideCommands: true,
      hideBots: true,
      showTips: true,
      showSubs: true,
      nameColor: "viewer",
      newestAt: "bottom",
      lifetimeSec: 0,
      maxMessages: 12,
      blockedWords: "",
    } satisfies ChatSettings as SettingsFor<T>;
  }
  return {
    ...appearance(),
    kinds: { ...ALL_KINDS },
    platforms: { ...ALL_PLATFORMS },
    showAvatars: true,
    maxItems: 6,
  } satisfies EventListSettings as SettingsFor<T>;
}

// ---- Validation -----------------------------------------------------------------------------

const ENUMS: Record<string, readonly string[]> = {
  style: ["signal", "clean", "bold"],
  position: POSITIONS,
  newestAt: ["bottom", "top"],
  animation: ["slide", "fade", "pop", "none"],
  nameColor: ["accent", "viewer"],
  font: FONTS.map((font) => font.id),
};

const RANGES: Record<string, [number, number]> = {
  durationSec: [2, 30],
  volume: [0, 1],
  minTip: [0, 100_000],
  minRaid: [0, 100_000],
  scale: [0.6, 2],
  lifetimeSec: [0, 600],
  maxMessages: [5, 100],
  maxItems: [1, 20],
  panelOpacity: [0, 1],
  radius: [0, 40],
};

const MAX_TEXT = 140;
const MAX_CSS = 10_000;

/**
 * Accepts untrusted input (API bodies, stored JSON from older versions) and returns complete,
 * valid settings shaped like the defaults: unknown keys dropped, wrong types replaced by the
 * default, numbers clamped, colours and URLs validated, text length-limited.
 */
export function sanitizeSettings<T extends OverlayType>(type: T, input: unknown): SettingsFor<T> {
  return sanitize(defaultSettings(type), input) as SettingsFor<T>;
}

function sanitize(fallback: unknown, value: unknown, key = ""): unknown {
  if (typeof fallback === "boolean") {
    return typeof value === "boolean" ? value : fallback;
  }
  if (typeof fallback === "number") {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return fallback;
    }
    const [min, max] = RANGES[key] ?? [-Infinity, Infinity];
    return Math.min(max, Math.max(min, value));
  }
  if (typeof fallback === "string") {
    if (typeof value !== "string") {
      return fallback;
    }
    if (ENUMS[key]) {
      return ENUMS[key].includes(value) ? value : fallback;
    }
    if (key.endsWith("Color")) {
      return /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : fallback;
    }
    if (key === "image" || key === "sound") {
      return value === "" || /^https:\/\/[^\s"'<>]+$/i.test(value) ? value.slice(0, 2048) : fallback;
    }
    if (key === "blockedWords") {
      return value.slice(0, 2000);
    }
    if (key === "customCss") {
      // The CSS sits inside a <style> element; never let it close the element.
      return value.slice(0, MAX_CSS).replace(/<\/?\s*style/gi, "");
    }
    return value.slice(0, MAX_TEXT);
  }
  if (fallback && typeof fallback === "object") {
    const source = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(fallback as Record<string, unknown>).map(([k, v]) => [k, sanitize(v, source[k], k)]));
  }
  return fallback;
}

export function isOverlayType(value: unknown): value is OverlayType {
  return value === "alerts" || value === "chat" || value === "events";
}
