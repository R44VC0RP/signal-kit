/**
 * Overlay types and their settings. Shared by the customizer, the API and the overlay page,
 * so it must stay free of server-only imports.
 *
 * Defaults follow what streamers know from Streamlabs and StreamElements ("Classic"): alerts
 * with art above centred, outlined text and a highlighted name; Twitch-style inline chat; the
 * same animate.css animation names and per-letter text animations.
 */

import type { StatMetric } from "./stats-core";

export type OverlayType = "alerts" | "chat" | "events" | "goal" | "label" | "emotewall" | "ticker" | "poll" | "giveaway" | "queue" | "highlight" | "viewers" | "credits" | "twitch" | "wheel" | "boss";
export const OVERLAY_TYPE_IDS: readonly OverlayType[] = ["alerts", "chat", "events", "goal", "label", "emotewall", "ticker", "poll", "giveaway", "queue", "highlight", "viewers", "credits", "twitch", "wheel", "boss"];
export type OverlayStyle = "classic" | "signal" | "clean" | "bold";
export type PlatformFilter = { twitch: boolean; youtube: boolean; x: boolean };

/** Events an alert, event-list or ticker overlay can show. Cheers are Twitch tips paid in Bits. */
export const ALERT_KINDS = ["follow", "subscription", "subscription.gift", "cheer", "tip", "raid", "redemption"] as const;
export type AlertKind = (typeof ALERT_KINDS)[number];

export const ALERT_KIND_LABEL: Record<AlertKind, string> = {
  follow: "Follows",
  subscription: "Subs & memberships",
  "subscription.gift": "Gift subs",
  cheer: "Cheers (Bits)",
  tip: "Tips & Super Chats",
  raid: "Raids",
  redemption: "Channel point redemptions",
};

/** What a variation's "at least" compares against, per alert kind. */
export const VARIATION_UNIT: Partial<Record<AlertKind, string>> = {
  subscription: "months",
  "subscription.gift": "gifted subs",
  cheer: "bits",
  tip: "amount",
  raid: "viewers",
};

/** Words a streamer can use in alert text. */
export const TEMPLATE_VARIABLES = ["name", "amount", "count", "months", "tier", "viewers", "reward", "platform", "message"] as const;

/**
 * A variation replaces the alert's text, art or sound when the value reaches `min`, e.g. a
 * bigger alert for tips of $50+ or resubs of 12+ months. Empty fields keep the base alert's.
 */
export type AlertVariation = { min: number; title: string; image: string; sound: string };

/** Per-kind alert content. Empty image/sound means Signal Kit's default art and sound. */
export type AlertTemplate = {
  enabled: boolean;
  /** Small label above the text (Signal, Bold styles). */
  label: string;
  title: string;
  showImage: boolean;
  image: string;
  sound: string;
  variations: AlertVariation[];
};

/** Signal Kit's default art for an alert kind (files in public/alerts/art). */
export function defaultArt(kind: AlertKind) {
  return `/alerts/art/${kind === "subscription.gift" ? "gift" : kind}.webp`;
}

/** Fonts the overlay can load (Google Fonts, plus the two brand fonts that are always loaded). */
export const FONTS: { id: string; name: string; family: string; google?: string }[] = [
  { id: "open-sans", name: "Open Sans", family: "'Open Sans', sans-serif", google: "Open+Sans:wght@400;600;700;800" },
  { id: "roboto", name: "Roboto", family: "'Roboto', sans-serif", google: "Roboto:wght@400;500;700;900" },
  { id: "nunito", name: "Nunito", family: "'Nunito', sans-serif", google: "Nunito:wght@400;600;700;800;900" },
  { id: "hubot", name: "Hubot Sans", family: "var(--font-hubot), sans-serif" },
  { id: "mona", name: "Mona Sans", family: "var(--font-mona), sans-serif" },
  { id: "inter", name: "Inter", family: "'Inter', sans-serif", google: "Inter:wght@400;500;600;700;800;900" },
  { id: "geist", name: "Geist", family: "'Geist', sans-serif", google: "Geist:wght@400;500;600;700;800" },
  { id: "lato", name: "Lato", family: "'Lato', sans-serif", google: "Lato:wght@400;700;900" },
  { id: "montserrat", name: "Montserrat", family: "'Montserrat', sans-serif", google: "Montserrat:wght@400;600;700;800;900" },
  { id: "poppins", name: "Poppins", family: "'Poppins', sans-serif", google: "Poppins:wght@400;600;700;800;900" },
  { id: "raleway", name: "Raleway", family: "'Raleway', sans-serif", google: "Raleway:wght@400;600;700;800;900" },
  { id: "rubik", name: "Rubik", family: "'Rubik', sans-serif", google: "Rubik:wght@400;600;700;800;900" },
  { id: "ubuntu", name: "Ubuntu", family: "'Ubuntu', sans-serif", google: "Ubuntu:wght@400;500;700" },
  { id: "kanit", name: "Kanit", family: "'Kanit', sans-serif", google: "Kanit:wght@400;600;700;800;900" },
  { id: "barlow", name: "Barlow", family: "'Barlow', sans-serif", google: "Barlow:wght@400;600;700;800;900" },
  { id: "outfit", name: "Outfit", family: "'Outfit', sans-serif", google: "Outfit:wght@400;600;700;800;900" },
  { id: "space-grotesk", name: "Space Grotesk", family: "'Space Grotesk', sans-serif", google: "Space+Grotesk:wght@400;600;700" },
  { id: "bricolage", name: "Bricolage Grotesque", family: "'Bricolage Grotesque', sans-serif", google: "Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700;12..96,800" },
  { id: "fredoka", name: "Fredoka", family: "'Fredoka', sans-serif", google: "Fredoka:wght@400;600;700" },
  { id: "exo2", name: "Exo 2", family: "'Exo 2', sans-serif", google: "Exo+2:wght@400;600;700;800;900" },
  { id: "orbitron", name: "Orbitron", family: "'Orbitron', sans-serif", google: "Orbitron:wght@400;600;700;800;900" },
  { id: "russo", name: "Russo One", family: "'Russo One', sans-serif", google: "Russo+One" },
  { id: "oswald", name: "Oswald", family: "'Oswald', sans-serif", google: "Oswald:wght@400;600;700" },
  { id: "anton", name: "Anton", family: "'Anton', sans-serif", google: "Anton" },
  { id: "bebas", name: "Bebas Neue", family: "'Bebas Neue', sans-serif", google: "Bebas+Neue" },
  { id: "bangers", name: "Bangers", family: "'Bangers', cursive", google: "Bangers" },
  { id: "luckiest", name: "Luckiest Guy", family: "'Luckiest Guy', cursive", google: "Luckiest+Guy" },
  { id: "lilita", name: "Lilita One", family: "'Lilita One', cursive", google: "Lilita+One" },
  { id: "permanent-marker", name: "Permanent Marker", family: "'Permanent Marker', cursive", google: "Permanent+Marker" },
  { id: "pacifico", name: "Pacifico", family: "'Pacifico', cursive", google: "Pacifico" },
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

// ---- Motion ---------------------------------------------------------------------------------

/** animate.css entrances (the set Streamlabs and StreamElements offer), with friendly names. */
export const ANIMATIONS_IN = [
  ["fadeIn", "Fade in"],
  ["fadeInUp", "Fade in up"],
  ["fadeInDown", "Fade in down"],
  ["fadeInLeft", "Fade in left"],
  ["fadeInRight", "Fade in right"],
  ["fadeInUpBig", "Fade in up (big)"],
  ["fadeInDownBig", "Fade in down (big)"],
  ["slideInUp", "Slide in up"],
  ["slideInDown", "Slide in down"],
  ["slideInLeft", "Slide in left"],
  ["slideInRight", "Slide in right"],
  ["zoomIn", "Zoom in"],
  ["zoomInUp", "Zoom in up"],
  ["zoomInDown", "Zoom in down"],
  ["bounceIn", "Bounce in"],
  ["bounceInUp", "Bounce in up"],
  ["bounceInDown", "Bounce in down"],
  ["bounceInLeft", "Bounce in left"],
  ["bounceInRight", "Bounce in right"],
  ["backInUp", "Back in up"],
  ["backInDown", "Back in down"],
  ["flipInX", "Flip in X"],
  ["flipInY", "Flip in Y"],
  ["lightSpeedInLeft", "Light speed left"],
  ["lightSpeedInRight", "Light speed right"],
  ["rotateIn", "Rotate in"],
  ["rollIn", "Roll in"],
  ["jackInTheBox", "Jack in the box"],
  ["none", "None"],
] as const;

export const ANIMATIONS_OUT = [
  ["fadeOut", "Fade out"],
  ["fadeOutUp", "Fade out up"],
  ["fadeOutDown", "Fade out down"],
  ["fadeOutLeft", "Fade out left"],
  ["fadeOutRight", "Fade out right"],
  ["fadeOutUpBig", "Fade out up (big)"],
  ["fadeOutDownBig", "Fade out down (big)"],
  ["slideOutUp", "Slide out up"],
  ["slideOutDown", "Slide out down"],
  ["slideOutLeft", "Slide out left"],
  ["slideOutRight", "Slide out right"],
  ["zoomOut", "Zoom out"],
  ["zoomOutUp", "Zoom out up"],
  ["zoomOutDown", "Zoom out down"],
  ["bounceOut", "Bounce out"],
  ["bounceOutUp", "Bounce out up"],
  ["bounceOutDown", "Bounce out down"],
  ["backOutUp", "Back out up"],
  ["backOutDown", "Back out down"],
  ["flipOutX", "Flip out X"],
  ["flipOutY", "Flip out Y"],
  ["lightSpeedOutLeft", "Light speed left"],
  ["lightSpeedOutRight", "Light speed right"],
  ["rotateOut", "Rotate out"],
  ["rollOut", "Roll out"],
  ["hinge", "Hinge"],
  ["none", "None"],
] as const;

/** Per-letter animations on the highlighted words ({name}, {amount}…), as in Streamlabs. */
export const TEXT_ANIMATIONS = [
  ["none", "None"],
  ["wiggle", "Wiggle"],
  ["wave", "Wave"],
  ["pulse", "Pulse"],
  ["bounce", "Bounce"],
  ["tada", "Tada"],
  ["rubberBand", "Rubber band"],
  ["wobble", "Wobble"],
  ["swing", "Swing"],
  ["shakeX", "Shake"],
  ["heartBeat", "Heartbeat"],
  ["jello", "Jello"],
  ["flash", "Flash"],
] as const;

export const TEXT_SHADOWS = [
  ["outline", "Outline"],
  ["soft", "Soft"],
  ["heavy", "Heavy"],
  ["glow", "Glow"],
  ["none", "None"],
] as const;

// ---- Appearance -----------------------------------------------------------------------------

/** Colours, type and shape shared by every overlay type. */
export type Appearance = {
  style: OverlayStyle;
  font: string;
  fontWeight: number;
  textColor: string;
  /** Highlight colour: names and amounts in alerts, goal bars, accents. */
  accentColor: string;
  panelColor: string;
  panelOpacity: number;
  /** Corner radius in px at 100% size. */
  radius: number;
  textShadow: (typeof TEXT_SHADOWS)[number][0];
  scale: number;
  /** Extra CSS for power users, applied last. */
  customCss: string;
};

export const POSITIONS = ["top-left", "top", "top-right", "left", "center", "right", "bottom-left", "bottom", "bottom-right"] as const;
export type Position = (typeof POSITIONS)[number];

export type AlertSettings = Appearance & {
  templates: Record<AlertKind, AlertTemplate>;
  platforms: PlatformFilter;
  /** Classic: art above the text, art beside it, or text on top of the art. */
  layout: "above" | "side" | "banner";
  position: Position;
  animationIn: (typeof ANIMATIONS_IN)[number][0];
  animationOut: (typeof ANIMATIONS_OUT)[number][0];
  textAnimation: (typeof TEXT_ANIMATIONS)[number][0];
  durationSec: number;
  /** The text appears this long after the art. */
  textDelaySec: number;
  /** Pause between queued alerts. */
  gapSec: number;
  titleSize: number;
  messageSize: number;
  messageColor: string;
  /** Art height in px on a 1080p canvas. */
  imageSize: number;
  showMessage: boolean;
  showAvatar: boolean;
  sound: boolean;
  volume: number;
  /** Money tips below this don't alert (in the tip's currency). */
  minTip: number;
  minCheer: number;
  minRaid: number;
  /** Comma-separated words; a message containing one is hidden from the alert. */
  blockedWords: string;
};

export type ChatSettings = Appearance & {
  platforms: PlatformFilter;
  /** Classic: "badges Name: message" on one line, name column + message, or each message boxed. */
  layout: "inline" | "columns" | "boxed";
  fontSize: number;
  animation: (typeof ANIMATIONS_IN)[number][0];
  showAvatars: boolean;
  showPlatform: boolean;
  showBadges: boolean;
  showColon: boolean;
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
  /** Hold each message back this long (time to delete it before it's on stream). */
  delaySec: number;
  maxMessages: number;
  /** Comma-separated names whose messages never show. */
  mutedUsers: string;
  /** Comma-separated words; messages containing one never show. */
  blockedWords: string;
};

export type EventListSettings = Appearance & {
  kinds: Record<AlertKind, boolean>;
  platforms: PlatformFilter;
  fontSize: number;
  animation: (typeof ANIMATIONS_IN)[number][0];
  newestAt: "bottom" | "top";
  showAvatars: boolean;
  showPlatform: boolean;
  maxItems: number;
};

export type GoalSettings = Appearance & {
  metric: StatMetric;
  /** Tips goals count one currency. */
  currency: string;
  title: string;
  target: number;
  /** Added to what's counted, e.g. progress made before the goal was set up here. */
  startValue: number;
  /** Optional end date (YYYY-MM-DD), shown under the bar. */
  endDate: string;
  layout: "standard" | "condensed" | "simple";
  barColor: string;
  barBackground: string;
  barTextColor: string;
  barHeight: number;
  showPercent: boolean;
};

export const LABEL_KINDS = [
  ["latest_follower", "Latest follower", "Latest follower: {name}"],
  ["latest_subscriber", "Latest subscriber", "Latest subscriber: {name}"],
  ["latest_gifter", "Latest gifter", "Latest gifter: {name} ({count})"],
  ["latest_tip", "Latest tip", "Latest tip: {name} {amount}"],
  ["latest_cheer", "Latest cheer", "Latest cheer: {name} {amount}"],
  ["latest_raid", "Latest raid", "Latest raid: {name} ({count})"],
  ["latest_member", "Latest YouTube member", "Latest member: {name}"],
  ["recent_followers", "Recent followers", "Recent followers: {list}"],
  ["recent_subscribers", "Recent subscribers", "Recent subs: {list}"],
  ["recent_tips", "Recent tips", "Recent tips: {list}"],
  ["recent_cheers", "Recent cheers", "Recent cheers: {list}"],
  ["session_followers", "Session followers", "Followers today: {count}"],
  ["session_subs", "Session subs", "Subs today: {count}"],
  ["session_bits", "Session bits", "Bits today: {count}"],
  ["session_tips", "Session tips", "Tips today: {amount}"],
  ["session_top_tip", "Session top tip", "Top tip: {name} {amount}"],
  ["session_top_cheer", "Session top cheer", "Top cheer: {name} {amount}"],
  ["session_top_gifter", "Session top gifter", "Top gifter: {name} ({count})"],
  ["total_followers", "Followers since tracking", "Followers: {count}"],
  ["total_subs", "Subs since tracking", "Subs: {count}"],
  ["total_bits", "Bits since tracking", "Bits: {count}"],
  ["total_tips", "Tips since tracking", "Tips: {amount}"],
  ["total_top_tip", "All-time top tip", "Top tip ever: {name} {amount}"],
] as const;
export type LabelKind = (typeof LABEL_KINDS)[number][0];

export type LabelSettings = Appearance & {
  label: LabelKind;
  template: string;
  /** Shown before there's anything to show. */
  emptyText: string;
  currency: string;
  fontSize: number;
  align: "left" | "center" | "right";
  /** Scroll the text like a marquee (for narrow spaces). */
  scroll: boolean;
  scrollSpeed: number;
};

export type EmoteWallSettings = Appearance & {
  platforms: PlatformFilter;
  animation: "random" | "rise" | "bounce" | "rain" | "fountain" | "zoom" | "float";
  emoteSize: number;
  durationSec: number;
  maxOnScreen: number;
  /** Emotes shown per message (a message of 20 Kappas shows this many). */
  perMessage: number;
  /** Only show an emote once it's used this many times within the window (combo). */
  comboMin: number;
  comboWindowSec: number;
  includeEmoji: boolean;
  /** Burst of the channel's emotes on big moments. */
  explodeOn: { subscription: boolean; "subscription.gift": boolean; cheer: boolean; tip: boolean; raid: boolean; follow: boolean };
  explodeCount: number;
};

export type TickerSettings = Appearance & {
  kinds: Record<AlertKind, boolean>;
  platforms: PlatformFilter;
  title: string;
  fontSize: number;
  maxItems: number;
  /** Pixels per second. */
  speed: number;
  separator: string;
};

/** Chat poll: viewers vote by typing the option number on any platform. */
export type PollSettings = Appearance & {
  fontSize: number;
  instructions: string;
  barColor: string;
  barBackground: string;
  showPercent: boolean;
  showVotes: boolean;
  /** Keep showing the result this long after the poll closes (0 = until cleared). */
  resultSec: number;
};

export type GiveawaySettings = Appearance & {
  fontSize: number;
  /** {keyword} becomes the entry word. */
  instructions: string;
  showEntries: boolean;
  sound: boolean;
  volume: number;
};

export type QueueSettings = Appearance & {
  fontSize: number;
  instructions: string;
  maxShown: number;
  showPlatform: boolean;
  hideWhenClosed: boolean;
};

export type HighlightSettings = Appearance & {
  fontSize: number;
  animation: (typeof ANIMATIONS_IN)[number][0];
  showAvatar: boolean;
  showPlatform: boolean;
  /** Hide a pinned message after this long (0 = until unpinned). */
  autoHideSec: number;
};

export type ViewersSettings = Appearance & {
  fontSize: number;
  /** One combined number, or one per platform. */
  mode: "total" | "split";
  label: string;
  showUptime: boolean;
  showLiveDot: boolean;
  align: "left" | "center" | "right";
};

export type CreditsSettings = Appearance & {
  title: string;
  fontSize: number;
  /** Pixels per second. */
  speed: number;
  loop: boolean;
  sections: { followers: boolean; subscribers: boolean; gifters: boolean; cheers: boolean; tips: boolean; raiders: boolean; chatters: boolean };
};

export type TwitchActivitySettings = Appearance & {
  fontSize: number;
  showHypeTrain: boolean;
  showPolls: boolean;
  showPredictions: boolean;
  barColor: string;
  barBackground: string;
};

/** Spin wheel: spun from Live tools, or when a viewer redeems a chosen channel point reward. */
export type WheelSettings = Appearance & {
  /** One option per line. */
  segments: string;
  spinSec: number;
  /** How long the result stays before the wheel hides (0 = always visible). */
  resultSec: number;
  /** Spin automatically when a channel point reward with this exact title is redeemed. */
  redemption: string;
  sound: boolean;
  volume: number;
};

/** Stream boss: support deals damage; whoever lands the final hit becomes the next boss. */
export type BossSettings = Appearance & {
  fontSize: number;
  title: string;
  barColor: string;
  barBackground: string;
  showAvatar: boolean;
};

export type SettingsFor<T extends OverlayType> = T extends "alerts"
  ? AlertSettings
  : T extends "chat"
    ? ChatSettings
    : T extends "events"
      ? EventListSettings
      : T extends "goal"
        ? GoalSettings
        : T extends "label"
          ? LabelSettings
          : T extends "emotewall"
            ? EmoteWallSettings
            : T extends "ticker"
              ? TickerSettings
              : T extends "poll"
                ? PollSettings
                : T extends "giveaway"
                  ? GiveawaySettings
                  : T extends "queue"
                    ? QueueSettings
                    : T extends "highlight"
                      ? HighlightSettings
                      : T extends "viewers"
                        ? ViewersSettings
                        : T extends "credits"
                          ? CreditsSettings
                          : T extends "twitch"
                            ? TwitchActivitySettings
                            : T extends "wheel"
                              ? WheelSettings
                              : BossSettings;
export type AnySettings =
  | AlertSettings
  | ChatSettings
  | EventListSettings
  | GoalSettings
  | LabelSettings
  | EmoteWallSettings
  | TickerSettings
  | PollSettings
  | GiveawaySettings
  | QueueSettings
  | HighlightSettings
  | ViewersSettings
  | CreditsSettings
  | TwitchActivitySettings
  | WheelSettings
  | BossSettings;

type PresetFields = Pick<Appearance, "textColor" | "accentColor" | "panelColor" | "panelOpacity" | "radius" | "font" | "fontWeight" | "textShadow">;

/** Picking a style applies its colours and type; everything stays editable afterwards. */
export const STYLE_PRESETS: Record<OverlayStyle, PresetFields> = {
  // The look streamers know from Streamlabs: white outlined text, teal-green highlight.
  classic: { textColor: "#ffffff", accentColor: "#32c3a6", panelColor: "#000000", panelOpacity: 0, radius: 0, font: "open-sans", fontWeight: 800, textShadow: "outline" },
  // Browser sources can't blur what's behind them, so panels rely on opacity for legibility.
  signal: { textColor: "#f5f5f5", accentColor: "#3d6bff", panelColor: "#0c0c0c", panelOpacity: 0.84, radius: 18, font: "hubot", fontWeight: 500, textShadow: "none" },
  clean: { textColor: "#ffffff", accentColor: "#2f5df5", panelColor: "#000000", panelOpacity: 0, radius: 0, font: "geist", fontWeight: 500, textShadow: "soft" },
  bold: { textColor: "#0a0a0a", accentColor: "#2f5df5", panelColor: "#ffffff", panelOpacity: 1, radius: 22, font: "bricolage", fontWeight: 700, textShadow: "none" },
};

/** A style's preset for one overlay type (Classic chat uses Roboto 700, as Streamlabs does). */
export function presetFor(style: OverlayStyle, type: OverlayType): PresetFields {
  const preset = STYLE_PRESETS[style];
  if (style === "classic" && type !== "alerts") {
    const boxed = type === "events" || type === "ticker";
    return { ...preset, font: "roboto", fontWeight: 700, ...(boxed ? { panelOpacity: 0.6, radius: 6 } : {}) };
  }
  return preset;
}

const ALL_PLATFORMS: PlatformFilter = { twitch: true, youtube: true, x: true };
const ALL_KINDS = Object.fromEntries(ALERT_KINDS.map((kind) => [kind, true])) as Record<AlertKind, boolean>;

const template = (label: string, title: string, variations: AlertVariation[] = []): AlertTemplate => ({ enabled: true, label, title, showImage: true, image: "", sound: "", variations });

/** Default wording, as Streamlabs and StreamElements word it. */
export const DEFAULT_TEMPLATES: Record<AlertKind, AlertTemplate> = {
  follow: template("New follower", "{name} is now following!"),
  subscription: template("New subscriber", "{name} just subscribed!", [{ min: 2, title: "{name} just resubscribed for {months} months!", image: "", sound: "" }]),
  "subscription.gift": template("Gift subs", "{name} just gifted {count} subs!"),
  cheer: template("Cheer", "{name} cheered {amount}!"),
  tip: template("Tip", "{name} just tipped {amount}!"),
  raid: template("Raid", "{name} is raiding with a party of {viewers}!"),
  redemption: template("Redemption", "{name} redeemed {reward}!"),
};

export const OVERLAY_TYPES: {
  type: OverlayType;
  name: string;
  description: string;
  /** Recommended browser-source size. */
  width: number;
  height: number;
}[] = [
  { type: "alerts", name: "Alert box", description: "Animated alerts with art and sound for follows, subs, cheers, tips and raids.", width: 1920, height: 1080 },
  { type: "chat", name: "Chat box", description: "Twitch, YouTube and X chat in one box, with emotes and badges.", width: 420, height: 720 },
  { type: "events", name: "Event list", description: "A running list of your latest follows, subs, tips and raids.", width: 400, height: 500 },
  { type: "goal", name: "Goal", description: "A progress bar for a follower, sub, bits or tip goal.", width: 600, height: 200 },
  { type: "label", name: "Label", description: "One line of text: latest follower, top tip, subs today and more.", width: 600, height: 80 },
  { type: "emotewall", name: "Emote wall", description: "Emotes from chat fly across the screen; bursts on subs and raids.", width: 1920, height: 1080 },
  { type: "ticker", name: "Ticker", description: "A scrolling strip of recent supporters.", width: 1920, height: 60 },
  { type: "poll", name: "Chat poll", description: "Live results while chat votes by typing 1, 2, 3 on any platform.", width: 640, height: 420 },
  { type: "giveaway", name: "Giveaway", description: "Entries from chat on every platform, then a winner reveal.", width: 640, height: 360 },
  { type: "queue", name: "Viewer queue", description: "Viewers type !join to get in line to play with you.", width: 420, height: 520 },
  { type: "highlight", name: "Chat highlight", description: "Pin any chat message on stream from the dashboard.", width: 900, height: 260 },
  { type: "viewers", name: "Viewer count", description: "Live viewers across Twitch and YouTube, with uptime.", width: 420, height: 90 },
  { type: "credits", name: "Credits", description: "End-of-stream credits: followers, subs, cheers, raiders, chatters.", width: 1920, height: 1080 },
  { type: "wheel", name: "Spin wheel", description: "Spin from the dashboard or with a channel point reward.", width: 640, height: 720 },
  { type: "boss", name: "Stream boss", description: "Support deals damage; the final hit makes that viewer the new boss.", width: 600, height: 160 },
  { type: "twitch", name: "Twitch activity", description: "Hype trains, Twitch polls and predictions as they happen.", width: 640, height: 640 },
];

/** Default top-left position on a 1920×1080 canvas (preview stage and automatic OBS setup). */
export const OVERLAY_PLACEMENT: Record<OverlayType, { x: number; y: number }> = {
  alerts: { x: 0, y: 0 },
  chat: { x: 48, y: 312 },
  events: { x: 1472, y: 48 },
  goal: { x: 48, y: 48 },
  label: { x: 48, y: 260 },
  emotewall: { x: 0, y: 0 },
  ticker: { x: 0, y: 1020 },
  poll: { x: 1232, y: 330 },
  giveaway: { x: 640, y: 360 },
  queue: { x: 1452, y: 300 },
  highlight: { x: 510, y: 760 },
  viewers: { x: 1452, y: 48 },
  credits: { x: 0, y: 0 },
  twitch: { x: 48, y: 48 },
  wheel: { x: 640, y: 180 },
  boss: { x: 48, y: 872 },
};

export function overlayTypeInfo(type: OverlayType) {
  return OVERLAY_TYPES.find((info) => info.type === type)!;
}

function appearance(type: OverlayType): Appearance {
  return { style: "classic", ...presetFor("classic", type), scale: 1, customCss: "" };
}

const DEFAULTS: { [T in OverlayType]: () => SettingsFor<T> } = {
  alerts: () => ({
    ...appearance("alerts"),
    templates: structuredClone(DEFAULT_TEMPLATES),
    platforms: { ...ALL_PLATFORMS },
    layout: "above",
    position: "center",
    animationIn: "fadeIn",
    animationOut: "fadeOut",
    textAnimation: "wiggle",
    durationSec: 8,
    textDelaySec: 0,
    gapSec: 1,
    titleSize: 64,
    messageSize: 30,
    messageColor: "#ffffff",
    imageSize: 300,
    showMessage: true,
    showAvatar: false,
    sound: true,
    volume: 0.8,
    minTip: 0,
    minCheer: 0,
    minRaid: 0,
    blockedWords: "",
  }),
  chat: () => ({
    ...appearance("chat"),
    platforms: { ...ALL_PLATFORMS },
    layout: "inline",
    fontSize: 20,
    animation: "fadeInRight",
    showAvatars: false,
    showPlatform: true,
    showBadges: true,
    showColon: true,
    hideCommands: true,
    hideBots: true,
    showTips: true,
    showSubs: true,
    nameColor: "viewer",
    newestAt: "bottom",
    lifetimeSec: 0,
    delaySec: 0,
    maxMessages: 30,
    mutedUsers: "",
    blockedWords: "",
  }),
  events: () => ({
    ...appearance("events"),
    kinds: { ...ALL_KINDS },
    platforms: { ...ALL_PLATFORMS },
    fontSize: 18,
    animation: "fadeInDown",
    newestAt: "top",
    showAvatars: false,
    showPlatform: true,
    maxItems: 6,
  }),
  goal: () => ({
    ...appearance("goal"),
    metric: "followers",
    currency: "USD",
    title: "Follower goal",
    target: 50,
    startValue: 0,
    endDate: "",
    layout: "standard",
    barColor: "#32c3a6",
    barBackground: "#2a2a2a",
    barTextColor: "#ffffff",
    barHeight: 48,
    showPercent: false,
  }),
  label: () => ({
    ...appearance("label"),
    label: "latest_follower",
    template: LABEL_KINDS[0][2],
    emptyText: "",
    currency: "USD",
    fontSize: 32,
    align: "left",
    scroll: false,
    scrollSpeed: 60,
  }),
  emotewall: () => ({
    ...appearance("emotewall"),
    platforms: { ...ALL_PLATFORMS },
    animation: "random",
    emoteSize: 112,
    durationSec: 5,
    maxOnScreen: 60,
    perMessage: 5,
    comboMin: 1,
    comboWindowSec: 10,
    includeEmoji: true,
    explodeOn: { subscription: true, "subscription.gift": true, cheer: true, tip: true, raid: true, follow: false },
    explodeCount: 40,
  }),
  poll: () => ({
    ...appearance("poll"),
    panelOpacity: 0.7,
    radius: 12,
    fontSize: 22,
    instructions: "Type the number in chat to vote",
    barColor: "#32c3a6",
    barBackground: "#2a2a2a",
    showPercent: true,
    showVotes: true,
    resultSec: 30,
  }),
  giveaway: () => ({
    ...appearance("giveaway"),
    panelOpacity: 0.7,
    radius: 12,
    fontSize: 24,
    instructions: "Type {keyword} in chat to enter!",
    showEntries: true,
    sound: true,
    volume: 0.8,
  }),
  queue: () => ({
    ...appearance("queue"),
    panelOpacity: 0.7,
    radius: 12,
    fontSize: 20,
    instructions: "Type !join to get in line",
    maxShown: 8,
    showPlatform: true,
    hideWhenClosed: false,
  }),
  highlight: () => ({
    ...appearance("highlight"),
    panelOpacity: 0.8,
    radius: 14,
    fontSize: 28,
    animation: "fadeInUp",
    showAvatar: true,
    showPlatform: true,
    autoHideSec: 0,
  }),
  viewers: () => ({
    ...appearance("viewers"),
    fontSize: 32,
    mode: "total",
    label: "viewers",
    showUptime: true,
    showLiveDot: true,
    align: "right",
  }),
  credits: () => ({
    ...appearance("credits"),
    title: "Thanks for watching!",
    fontSize: 30,
    speed: 70,
    loop: true,
    sections: { followers: true, subscribers: true, gifters: true, cheers: true, tips: true, raiders: true, chatters: true },
  }),
  wheel: () => ({
    ...appearance("wheel"),
    segments: "Hydrate\nPush-ups\nSing a song\nViewer picks a game\nNo mic for 1 minute\nGive away a key",
    spinSec: 6,
    resultSec: 10,
    redemption: "",
    sound: true,
    volume: 0.6,
  }),
  boss: () => ({
    ...appearance("boss"),
    panelOpacity: 0.7,
    radius: 12,
    fontSize: 22,
    title: "Stream boss",
    barColor: "#e5484d",
    barBackground: "#2a2a2a",
    showAvatar: true,
  }),
  twitch: () => ({
    ...appearance("twitch"),
    panelOpacity: 0.7,
    radius: 12,
    fontSize: 22,
    showHypeTrain: true,
    showPolls: true,
    showPredictions: true,
    barColor: "#9146ff",
    barBackground: "#2a2a2a",
  }),
  ticker: () => ({
    ...appearance("ticker"),
    kinds: { ...ALL_KINDS },
    platforms: { ...ALL_PLATFORMS },
    title: "Recent supporters",
    fontSize: 22,
    maxItems: 15,
    speed: 80,
    separator: "•",
  }),
};

export function defaultSettings<T extends OverlayType>(type: T): SettingsFor<T> {
  return DEFAULTS[type]() as SettingsFor<T>;
}

// ---- Validation -----------------------------------------------------------------------------

const ids = (list: readonly (readonly [string, ...string[]])[]) => list.map((entry) => entry[0]);

/** Allowed values per setting; "type.key" entries override "key" for one overlay type. */
const ENUMS: Record<string, readonly string[]> = {
  style: ["classic", "signal", "clean", "bold"],
  position: POSITIONS,
  newestAt: ["bottom", "top"],
  nameColor: ["accent", "viewer"],
  font: FONTS.map((font) => font.id),
  textShadow: ids(TEXT_SHADOWS),
  animationIn: ids(ANIMATIONS_IN),
  animationOut: ids(ANIMATIONS_OUT),
  animation: ids(ANIMATIONS_IN),
  textAnimation: ids(TEXT_ANIMATIONS),
  "alerts.layout": ["above", "side", "banner"],
  "chat.layout": ["inline", "columns", "boxed"],
  "goal.layout": ["standard", "condensed", "simple"],
  "emotewall.animation": ["random", "rise", "bounce", "rain", "fountain", "zoom", "float"],
  mode: ["total", "split"],
  metric: ["followers", "subs", "gifts", "bits", "tips", "members", "raids"],
  label: ids(LABEL_KINDS),
  align: ["left", "center", "right"],
};

const RANGES: Record<string, [number, number]> = {
  durationSec: [1, 60],
  textDelaySec: [0, 10],
  gapSec: [0, 10],
  titleSize: [12, 200],
  messageSize: [10, 120],
  imageSize: [40, 1000],
  volume: [0, 1],
  minTip: [0, 100_000],
  minCheer: [0, 1_000_000],
  minRaid: [0, 100_000],
  scale: [0.5, 2.5],
  fontSize: [8, 120],
  fontWeight: [100, 900],
  lifetimeSec: [0, 600],
  delaySec: [0, 10],
  maxMessages: [3, 100],
  maxItems: [1, 30],
  panelOpacity: [0, 1],
  radius: [0, 40],
  target: [1, 100_000_000],
  startValue: [0, 100_000_000],
  barHeight: [8, 200],
  scrollSpeed: [10, 400],
  speed: [10, 400],
  emoteSize: [24, 400],
  "emotewall.durationSec": [2, 20],
  maxOnScreen: [5, 300],
  perMessage: [1, 20],
  comboMin: [1, 50],
  comboWindowSec: [2, 60],
  explodeCount: [5, 300],
  min: [0, 100_000_000],
  resultSec: [0, 600],
  spinSec: [2, 20],
  maxShown: [1, 30],
  autoHideSec: [0, 600],
};

/** Array settings and the shape of their items. */
const ARRAY_ITEMS: Record<string, { item: unknown; max: number }> = {
  variations: { item: { min: 1, title: "", image: "", sound: "" } satisfies AlertVariation, max: 8 },
};

const MAX_TEXT = 200;
const MAX_CSS = 10_000;

/**
 * Accepts untrusted input (API bodies, stored JSON from older versions) and returns complete,
 * valid settings shaped like the defaults: unknown keys dropped, wrong types replaced by the
 * default, numbers clamped, colours and URLs validated, text length-limited.
 */
export function sanitizeSettings<T extends OverlayType>(type: T, input: unknown): SettingsFor<T> {
  return sanitize(defaultSettings(type), input, "", type) as SettingsFor<T>;
}

function sanitize(fallback: unknown, value: unknown, key: string, type: OverlayType): unknown {
  if (Array.isArray(fallback)) {
    const spec = ARRAY_ITEMS[key];
    if (!spec || !Array.isArray(value)) {
      return fallback;
    }
    return value.slice(0, spec.max).map((item) => sanitize(spec.item, item, "", type));
  }
  if (typeof fallback === "boolean") {
    return typeof value === "boolean" ? value : fallback;
  }
  if (typeof fallback === "number") {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return fallback;
    }
    const [min, max] = RANGES[`${type}.${key}`] ?? RANGES[key] ?? [-Infinity, Infinity];
    return Math.min(max, Math.max(min, value));
  }
  if (typeof fallback === "string") {
    if (typeof value !== "string") {
      return fallback;
    }
    const allowed = ENUMS[`${type}.${key}`] ?? ENUMS[key];
    if (allowed) {
      return allowed.includes(value) ? value : fallback;
    }
    if (key.endsWith("Color") || key === "barBackground") {
      return /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : fallback;
    }
    if (key === "image" || key === "sound") {
      // A streamer's HTTPS URL, or a file from Signal Kit's own library.
      return value === "" || /^https:\/\/[^\s"'<>]+$/i.test(value) || /^\/(library|alerts)\/(?!.*\.\.)[\w./-]+$/.test(value) ? value.slice(0, 2048) : fallback;
    }
    if (key === "currency") {
      return /^[a-z]{3}$/i.test(value) ? value.toUpperCase() : fallback;
    }
    if (key === "endDate") {
      return value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback;
    }
    if (key === "blockedWords" || key === "mutedUsers" || key === "segments") {
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
    return Object.fromEntries(Object.entries(fallback as Record<string, unknown>).map(([k, v]) => [k, sanitize(v, source[k], k, type)]));
  }
  return fallback;
}

export function isOverlayType(value: unknown): value is OverlayType {
  return typeof value === "string" && (OVERLAY_TYPE_IDS as readonly string[]).includes(value);
}
