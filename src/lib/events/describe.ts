import type { Platform } from "@/db/schema";

export type EventCategory = "chat" | "alerts" | "money" | "system";

export type DescribedEvent = {
  platform: Platform;
  kind: string;
  from: string;
  details: string;
  value: string;
  category: EventCategory;
};

type RelayMessage = { type?: string; provider?: string; event?: unknown };

// Raw platform payloads are loosely typed; read fields defensively.
type Any = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * Turns a relay message into a readable row for the dashboard.
 * This is presentation only; the normalized event format for apps comes later.
 */
export function describeEvent(message: RelayMessage): DescribedEvent | null {
  const type = message.type ?? "";
  const event = (message.event ?? {}) as Any;
  if (!type || type.startsWith("signal_kit.")) {
    return null;
  }
  if (message.provider === "youtube" || type.startsWith("youtube.")) {
    return describeYouTube(type, event);
  }
  return describeTwitch(type, event);
}

function describeTwitch(type: string, e: Any): DescribedEvent {
  const base = { platform: "twitch" as const, value: "", category: "alerts" as EventCategory };
  const user = e.user_name ?? e.chatter_user_name ?? "Anonymous";
  switch (type) {
    case "channel.chat.message":
      return { ...base, kind: "Chat", from: e.chatter_user_name ?? "", details: e.message?.text ?? "", category: "chat" };
    case "channel.chat.notification":
      return { ...base, kind: "Chat notice", from: e.chatter_user_name ?? "", details: e.system_message ?? e.notice_type ?? "" };
    case "channel.follow":
      return { ...base, kind: "Follow", from: user, details: "followed the channel" };
    case "channel.subscribe":
      return { ...base, kind: "Subscription", from: user, details: e.is_gift ? "received a gift sub" : "subscribed", value: tier(e.tier) };
    case "channel.subscription.message":
      return {
        ...base,
        kind: "Resub",
        from: user,
        details: e.message?.text || `${e.cumulative_months ?? ""} months`,
        value: tier(e.tier),
      };
    case "channel.subscription.gift":
      return { ...base, kind: "Gift subs", from: e.is_anonymous ? "Anonymous" : user, details: `gifted ${e.total} subs`, value: `${e.total} subs`, category: "money" };
    case "channel.cheer":
      return { ...base, kind: "Cheer", from: e.is_anonymous ? "Anonymous" : user, details: e.message ?? "", value: `${e.bits} bits`, category: "money" };
    case "channel.bits.use":
      return { ...base, kind: "Bits", from: user, details: e.message?.text ?? e.type ?? "", value: `${e.bits} bits`, category: "money" };
    case "channel.raid":
      return { ...base, kind: "Raid", from: e.from_broadcaster_user_name ?? "", details: `raided with ${e.viewers} viewers`, value: String(e.viewers ?? "") };
    case "channel.channel_points_custom_reward_redemption.add":
      return { ...base, kind: "Redemption", from: user, details: e.reward?.title ?? "", value: e.reward?.cost ? `${e.reward.cost} pts` : "" };
    case "channel.hype_train.begin":
    case "channel.hype_train.progress":
    case "channel.hype_train.end":
      return { ...base, kind: "Hype train", from: "", details: type.split(".").pop() ?? "", value: e.level ? `Level ${e.level}` : "" };
    case "stream.online":
      return { ...base, kind: "Stream online", from: e.broadcaster_user_name ?? "", details: "went live", category: "system" };
    case "stream.offline":
      return { ...base, kind: "Stream offline", from: e.broadcaster_user_name ?? "", details: "ended the stream", category: "system" };
    case "channel.update":
      return { ...base, kind: "Stream info", from: e.broadcaster_user_name ?? "", details: e.title ?? "", category: "system" };
    default:
      return { ...base, kind: humanize(type.replace(/^channel\./, "")), from: user === "Anonymous" ? "" : user, details: "", category: "system" };
  }
}

function describeYouTube(type: string, m: Any): DescribedEvent {
  const base = { platform: "youtube" as const, value: "", category: "alerts" as EventCategory };
  const from = m.authorDetails?.displayName ?? "";
  const snippet = (m.snippet ?? {}) as Any;
  const kind = type.replace(/^youtube\.live_chat\./, "");
  switch (kind) {
    case "textMessageEvent":
    case "message":
      return { ...base, kind: "Chat", from, details: snippet.displayMessage ?? "", category: "chat" };
    case "superChatEvent":
    case "super_chat":
      return { ...base, kind: "Super Chat", from, details: snippet.superChatDetails?.userComment ?? "", value: snippet.superChatDetails?.amountDisplayString ?? "", category: "money" };
    case "superStickerEvent":
    case "super_sticker":
      return { ...base, kind: "Super Sticker", from, details: snippet.superStickerDetails?.superStickerMetadata?.altText ?? "", value: snippet.superStickerDetails?.amountDisplayString ?? "", category: "money" };
    case "newSponsorEvent":
    case "new_sponsor":
      return { ...base, kind: "Membership", from, details: "became a member" };
    case "memberMilestoneChatEvent":
    case "member_milestone":
      return { ...base, kind: "Member milestone", from, details: snippet.memberMilestoneChatDetails?.userComment ?? "", value: `${snippet.memberMilestoneChatDetails?.memberMonth ?? ""} mo` };
    case "membershipGiftingEvent":
    case "membership_gifting":
      return { ...base, kind: "Gift memberships", from, details: "gifted memberships", value: String(snippet.membershipGiftingDetails?.giftMembershipsCount ?? ""), category: "money" };
    case "ended":
      return { ...base, kind: "Chat ended", from: "", details: "the live chat ended", category: "system" };
    default:
      return { ...base, kind: humanize(kind), from, details: snippet.displayMessage ?? "", category: "system" };
  }
}

function tier(value: unknown) {
  return value === "2000" ? "Tier 2" : value === "3000" ? "Tier 3" : value === "1000" ? "Tier 1" : "";
}

function humanize(value: string) {
  const text = value.replace(/Event$/, "").replace(/[._]/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}
