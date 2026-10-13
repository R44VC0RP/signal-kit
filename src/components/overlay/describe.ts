import type { SignalKitEvent } from "@/lib/events/types";
import type { AlertKind, AlertSettings, EventListSettings } from "@/lib/overlays/settings";

/** On-stream wording for an event: a short headline plus an optional detail line. */
export function alertText(event: SignalKitEvent): { title: string; detail: string | null } {
  const name = event.actor?.name || "Someone";
  const data = event.data ?? {};
  switch (event.kind) {
    case "follow":
      return { title: `${name} followed`, detail: null };
    case "subscription": {
      if (event.platform === "youtube") {
        return { title: `${name} became a member`, detail: typeof data.level === "string" ? data.level : null };
      }
      const months = typeof data.months === "number" && data.months > 1 ? `${data.months} months` : null;
      return { title: `${name} subscribed`, detail: [months, tierLabel(data.tier)].filter(Boolean).join(" · ") || null };
    }
    case "subscription.gift": {
      const count = typeof data.count === "number" ? data.count : 1;
      return { title: `${name} gifted ${count} ${event.platform === "youtube" ? (count === 1 ? "membership" : "memberships") : count === 1 ? "sub" : "subs"}`, detail: null };
    }
    case "tip":
      return { title: `${name} sent ${event.amount?.display ?? "a tip"}`, detail: null };
    case "raid": {
      const viewers = typeof data.viewers === "number" ? data.viewers : 0;
      return { title: `${name} is raiding`, detail: `with ${viewers.toLocaleString("en")} ${viewers === 1 ? "viewer" : "viewers"}` };
    }
    case "redemption": {
      const reward = (data.reward as { title?: string } | undefined)?.title;
      return { title: `${name} redeemed ${reward ?? "a reward"}`, detail: null };
    }
    default:
      return { title: name, detail: event.message };
  }
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
  if (!(event.kind in settings.kinds) || !settings.kinds[event.kind as AlertKind]) {
    return false;
  }
  if (event.kind === "tip" && "minTip" in settings && (event.amount?.value ?? 0) < settings.minTip) {
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
