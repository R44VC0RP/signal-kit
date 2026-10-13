import type { SignalKitEvent } from "@/lib/events/types";
import { DEFAULT_TEMPLATES, type AlertKind, type AlertSettings, type AlertTemplate, type EventListSettings, type TEMPLATE_VARIABLES } from "@/lib/overlays/settings";

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
  const kind = event.kind as AlertKind;
  const template = templates[kind] ?? DEFAULT_TEMPLATES.follow;
  let title = template.title;
  // The default wording follows each platform: YouTube has members, not subscribers.
  if (kind === "subscription" && event.platform === "youtube" && title === DEFAULT_TEMPLATES.subscription.title) {
    title = "{name} became a member";
  }
  if (kind === "subscription.gift" && event.platform === "youtube" && title === DEFAULT_TEMPLATES["subscription.gift"].title) {
    title = "{name} gifted {count} memberships";
  }
  const data = event.data ?? {};
  const detail =
    kind === "subscription"
      ? [typeof data.months === "number" && data.months > 1 ? `${data.months} months` : null, tierLabel(data.tier)].filter(Boolean).join(" · ") || null
      : null;
  return { label: template.label, title: fillTemplate(title, event), parts: templateParts(title, event), detail };
}

function tierLabel(tier: unknown) {
  if (tier === "prime") {
    return "Prime";
  }
  return typeof tier === "number" && tier > 1 ? `Tier ${tier}` : null;
}

/** Whether an alert or event-list overlay should show this event under its settings. */
export function matchesAlert(event: SignalKitEvent, settings: AlertSettings | EventListSettings) {
  if (!settings.platforms[event.platform]) {
    return false;
  }
  const kind = event.kind as AlertKind;
  const enabled = "templates" in settings ? settings.templates[kind]?.enabled : settings.kinds[kind];
  if (!enabled) {
    return false;
  }
  if (event.kind === "tip" && "minTip" in settings && (event.amount?.value ?? 0) < settings.minTip) {
    return false;
  }
  if (event.kind === "raid" && "minRaid" in settings && Number(event.data?.viewers ?? 0) < settings.minRaid) {
    return false;
  }
  return true;
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
