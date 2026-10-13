import type { SignalKitEvent } from "@/lib/events/types";
import { defaultArt, DEFAULT_TEMPLATES, type AlertKind, type AlertSettings, type AlertTemplate, type AlertVariation, type PlatformFilter, type TEMPLATE_VARIABLES } from "@/lib/overlays/settings";

/** The alert kind an event shows as: Bits tips are cheers; other kinds map one-to-one. */
export function alertKindOf(event: SignalKitEvent): AlertKind | null {
  if (event.kind === "tip") {
    return event.amount?.currency === "BITS" ? "cheer" : "tip";
  }
  return (["follow", "subscription", "subscription.gift", "raid", "redemption"] as const).find((kind) => kind === event.kind) ?? null;
}

/** The number a variation compares against: months, gifted subs, bits, tip amount, viewers. */
export function variationValue(event: SignalKitEvent): number {
  const data = event.data ?? {};
  switch (alertKindOf(event)) {
    case "subscription":
      return typeof data.months === "number" ? data.months : 1;
    case "subscription.gift":
      return typeof data.count === "number" ? data.count : 1;
    case "cheer":
    case "tip":
      return event.amount?.value ?? 0;
    case "raid":
      return Number(data.viewers ?? 0) || 0;
    default:
      return 0;
  }
}

/** The variation with the highest threshold the event reaches, if any. */
export function pickVariation(event: SignalKitEvent, template: AlertTemplate): AlertVariation | null {
  const value = variationValue(event);
  return [...template.variations].filter((variation) => value >= variation.min).sort((a, b) => b.min - a.min)[0] ?? null;
}

/** Values a template can use, e.g. "{name} sent {amount}". */
export function templateValues(event: SignalKitEvent): Record<(typeof TEMPLATE_VARIABLES)[number], string> {
  const data = event.data ?? {};
  const reward = (data.reward as { title?: string } | undefined)?.title;
  const count = typeof data.count === "number" ? data.count : 1;
  const viewers = typeof data.viewers === "number" ? data.viewers : 0;
  return {
    name: event.actor?.name || "Someone",
    amount: event.amount?.display ?? "",
    count: String(count),
    months: typeof data.months === "number" ? String(data.months) : "1",
    tier: tierLabel(data.tier) ?? "Tier 1",
    viewers: viewers.toLocaleString("en"),
    reward: reward ?? "a reward",
    platform: event.platform === "x" ? "X" : event.platform === "youtube" ? "YouTube" : "Twitch",
    message: event.message ?? "",
  };
}

/** A template split into plain text and variables, so the name and amount can be styled. */
export function templateParts(template: string, event: SignalKitEvent): { text: string; variable?: string }[] {
  const values = templateValues(event) as Record<string, string>;
  const parts: { text: string; variable?: string }[] = [];
  let last = 0;
  for (const match of template.matchAll(/\{(\w+)\}/g)) {
    if (match.index > last) {
      parts.push({ text: template.slice(last, match.index) });
    }
    const key = match[1];
    parts.push(key in values ? { text: values[key], variable: key } : { text: match[0] });
    last = match.index + match[0].length;
  }
  if (last < template.length) {
    parts.push({ text: template.slice(last) });
  }
  return parts;
}

export function fillTemplate(template: string, event: SignalKitEvent) {
  const values = templateValues(event) as Record<string, string>;
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? values[key] : match)).replace(/\s{2,}/g, " ").trim();
}

/** On-stream wording for an event: a headline (from the streamer's template) and a detail line. */
export function alertText(event: SignalKitEvent, templates: Record<AlertKind, AlertTemplate> = DEFAULT_TEMPLATES) {
  const kind = alertKindOf(event) ?? "follow";
  const template = templates[kind] ?? DEFAULT_TEMPLATES.follow;
  const variation = pickVariation(event, template);
  let title = variation?.title || template.title;
  // The default wording follows each platform: YouTube has members, not subscribers.
  if (kind === "subscription" && event.platform === "youtube" && title === DEFAULT_TEMPLATES.subscription.title) {
    title = "{name} just became a member!";
  }
  if (kind === "subscription.gift" && event.platform === "youtube" && title === DEFAULT_TEMPLATES["subscription.gift"].title) {
    title = "{name} just gifted {count} memberships!";
  }
  if (kind === "tip" && event.platform === "youtube" && title === DEFAULT_TEMPLATES.tip.title) {
    title = "{name} sent a Super Chat: {amount}!";
  }
  const data = event.data ?? {};
  const detail =
    kind === "subscription"
      ? [typeof data.months === "number" && data.months > 1 ? `${data.months} months` : null, tierLabel(data.tier)].filter(Boolean).join(" · ") || null
      : null;
  return {
    label: template.label,
    title: fillTemplate(title, event),
    parts: templateParts(title, event),
    detail,
    image: template.showImage ? variation?.image || template.image || defaultArt(kind) : null,
    /** Only art the streamer set (the card styles show the avatar instead of default art). */
    customImage: template.showImage ? variation?.image || template.image || null : null,
    sound: variation?.sound || template.sound || `/alerts/sounds/${kind === "cheer" ? "cheer" : kind === "subscription.gift" ? "gift" : kind}.mp3`,
  };
}

function tierLabel(tier: unknown) {
  if (tier === "prime") {
    return "Prime";
  }
  return typeof tier === "number" && tier > 1 ? `Tier ${tier}` : null;
}

/** Whether an alert, event-list or ticker overlay should show this event under its settings. */
export function matchesAlert(event: SignalKitEvent, settings: AlertSettings | { platforms: PlatformFilter; kinds: Record<AlertKind, boolean> }) {
  if (!settings.platforms[event.platform]) {
    return false;
  }
  const kind = alertKindOf(event);
  if (!kind) {
    return false;
  }
  const enabled = "templates" in settings ? settings.templates[kind]?.enabled : settings.kinds[kind];
  if (!enabled) {
    return false;
  }
  if (kind === "tip" && "minTip" in settings && (event.amount?.value ?? 0) < settings.minTip) {
    return false;
  }
  if (kind === "cheer" && "minCheer" in settings && (event.amount?.value ?? 0) < settings.minCheer) {
    return false;
  }
  if (event.kind === "raid" && "minRaid" in settings && Number(event.data?.viewers ?? 0) < settings.minRaid) {
    return false;
  }
  return true;
}

/** Twitch's default name colours, used (stably per name) when a viewer never picked one. */
const TWITCH_DEFAULT_COLORS = ["#ff0000", "#0000ff", "#008000", "#b22222", "#ff7f50", "#9acd32", "#ff4500", "#2e8b57", "#daa520", "#d2691e", "#5f9ea0", "#1e90ff", "#ff69b4", "#8a2be2", "#00ff7f"];

export function defaultNameColor(name: string) {
  let hash = 0;
  for (const char of name.toLowerCase()) {
    hash = (hash * 31 + char.charCodeAt(0)) | 0;
  }
  return TWITCH_DEFAULT_COLORS[Math.abs(hash) % TWITCH_DEFAULT_COLORS.length];
}

/** True when the name is in the comma-separated muted list (case-insensitive, @ optional). */
export function isMuted(event: SignalKitEvent, mutedUsers: string) {
  if (!mutedUsers.trim()) {
    return false;
  }
  const muted = new Set(mutedUsers.split(",").map((name) => name.trim().replace(/^@/, "").toLowerCase()).filter(Boolean));
  return [event.actor?.login, event.actor?.name].some((name) => name && muted.has(String(name).replace(/^@/, "").toLowerCase()));
}

/** A stable colour per name for avatar initials (platforms like Twitch chat send no picture). */
export function nameColor(name: string) {
  let hash = 0;
  for (const char of name) {
    hash = (hash * 31 + char.charCodeAt(0)) | 0;
  }
  return `oklch(0.62 0.13 ${Math.abs(hash) % 360})`;
}

/** True when the text contains one of the comma-separated blocked words (case-insensitive). */
export function hasBlockedWord(text: string | null | undefined, blockedWords: string) {
  if (!text || !blockedWords.trim()) {
    return false;
  }
  const lower = text.toLowerCase();
  return blockedWords
    .split(",")
    .map((word) => word.trim().toLowerCase())
    .some((word) => word && lower.includes(word));
}

/** Well-known chat bots, hidden from the chat overlay when "hide bots" is on. */
const BOTS = new Set(["nightbot", "streamelements", "streamlabs", "moobot", "fossabot", "wizebot", "botrix", "sery_bot", "soundalerts", "kofistreambot"]);

export function isBot(event: SignalKitEvent) {
  const names = [event.actor?.login, event.actor?.name].filter(Boolean).map((name) => String(name).toLowerCase());
  return names.some((name) => BOTS.has(name));
}

/** Compact wording for lists and tickers: the name, then what they did ("subscribed · 6 months"). */
export function shortAction(event: SignalKitEvent): { name: string; action: string; amount: string | null } {
  const data = event.data ?? {};
  const name = event.actor?.name || "Someone";
  const youtube = event.platform === "youtube";
  switch (alertKindOf(event)) {
    case "follow":
      return { name, action: "followed", amount: null };
    case "subscription": {
      const months = typeof data.months === "number" && data.months > 1 ? data.months : null;
      return { name, action: youtube ? "became a member" : months ? "resubscribed" : "subscribed", amount: months ? `${months} months` : null };
    }
    case "subscription.gift":
      return { name, action: youtube ? "gifted memberships" : "gifted subs", amount: `×${typeof data.count === "number" ? data.count : 1}` };
    case "cheer":
      return { name, action: "cheered", amount: event.amount?.display ?? null };
    case "tip":
      return { name, action: youtube ? "Super Chat" : "tipped", amount: event.amount?.display ?? null };
    case "raid":
      return { name, action: "raided", amount: `${Number(data.viewers ?? 0).toLocaleString("en")} viewers` };
    case "redemption":
      return { name, action: "redeemed", amount: (data.reward as { title?: string } | undefined)?.title ?? null };
    default:
      return { name, action: event.kind, amount: null };
  }
}
