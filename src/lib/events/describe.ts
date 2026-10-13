import type { EventKind, EventPlatform, SignalKitEvent } from "./types";

export type EventCategory = "chat" | "alerts" | "money" | "system";

export type DescribedEvent = {
  platform: EventPlatform;
  kind: string;
  from: string;
  /** Sender's profile picture when the platform provides one (YouTube, X). */
  avatarUrl: string | null;
  /** Twitch's own badge images for the sender (moderator, VIP, the channel's sub badges…). */
  badgeImages: { url: string; title: string }[];
  /** X verification type for the sender, shown with X's own badge. */
  xVerified: "blue" | "business" | "government" | null;
  details: string;
  value: string;
  category: EventCategory;
};

const LABEL: Record<EventKind, string> = {
  "chat.message": "Chat",
  "chat.message.deleted": "Message deleted",
  "chat.notification": "Chat notice",
  "chat.settings": "Chat settings",
  follow: "Follow",
  subscription: "Subscription",
  "subscription.gift": "Gift subs",
  "subscription.end": "Sub ended",
  tip: "Tip",
  raid: "Raid",
  redemption: "Redemption",
  hype_train: "Hype train",
  poll: "Poll",
  prediction: "Prediction",
  goal: "Goal",
  charity: "Charity",
  shoutout: "Shoutout",
  ad_break: "Ad break",
  moderation: "Moderation",
  "stream.online": "Stream online",
  "stream.offline": "Stream offline",
  "stream.update": "Stream info",
  other: "Other",
};

const TIP_LABEL: Record<string, string> = { cheer: "Cheer", super_chat: "Super Chat", super_sticker: "Super Sticker", charity: "Donation", gift: "Gift" };

/** Presentation for the dashboard's event log, built from the normalized event. */
export function describeEvent(event: Partial<SignalKitEvent> & { type?: string }): DescribedEvent | null {
  if (event.v !== 2 || !event.kind || !event.platform) {
    return null;
  }
  const data = event.data ?? {};
  const kind = event.kind === "tip" ? (TIP_LABEL[String(data.source)] ?? "Tip") : LABEL[event.kind];
  return {
    platform: event.platform,
    kind,
    from: event.actor?.name ?? "",
    avatarUrl: event.actor?.avatarUrl ?? null,
    xVerified: event.platform === "x" ? xVerifiedType(event.actor?.badges ?? []) : null,
    badgeImages: (event.actor?.badgeImages ?? []).slice(0, 3).map(({ url, title }) => ({ url, title })),
    details: event.message ?? detailsFor(event.kind, data),
    value: event.amount?.display ?? valueFor(event.kind, data),
    category: categoryFor(event.kind),
  };
}

function categoryFor(kind: EventKind): EventCategory {
  if (kind === "chat.message" || kind === "chat.message.deleted" || kind === "chat.notification") {
    return "chat";
  }
  if (kind === "tip" || kind === "subscription.gift") {
    return "money";
  }
  if (kind.startsWith("stream.") || kind === "chat.settings" || kind === "ad_break" || kind === "other") {
    return "system";
  }
  return "alerts";
}

function detailsFor(kind: EventKind, data: Record<string, unknown>) {
  switch (kind) {
    case "follow":
      return "followed";
    case "subscription":
      return data.isGift ? "received a gift sub" : data.months ? `${data.months} months` : "subscribed";
    case "subscription.gift":
      return `gifted ${data.count ?? 1}`;
    case "raid":
      return `raided with ${data.viewers ?? 0} viewers`;
    case "redemption":
      return String((data.reward as { title?: string } | undefined)?.title ?? "");
    case "stream.update":
      return String(data.title ?? "");
    case "stream.online":
      return "went live";
    case "stream.offline":
      return "stream ended";
    default:
      return typeof data.phase === "string" ? data.phase : "";
  }
}

function valueFor(kind: EventKind, data: Record<string, unknown>) {
  if (kind === "subscription" && data.tier) {
    return typeof data.tier === "number" ? `Tier ${data.tier}` : String(data.tier);
  }
  if (kind === "raid") {
    return String(data.viewers ?? "");
  }
  if (kind === "hype_train" && data.level) {
    return `Level ${data.level}`;
  }
  return "";
}

function xVerifiedType(badges: string[]) {
  return badges.includes("verified-business") ? "business" : badges.includes("verified-government") ? "government" : badges.includes("verified") ? "blue" : null;
}
