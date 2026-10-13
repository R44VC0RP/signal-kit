import type { EventActor, EventAmount, EventKind } from "./types";

/** The platform-independent part of an event; ids, channel and timestamps are added at ingest. */
export type NormalizedFields = {
  kind: EventKind;
  actor: EventActor | null;
  message: string | null;
  amount: EventAmount | null;
  data: Record<string, unknown>;
  occurredAt?: string;
};

// Raw payloads are third-party JSON; read them defensively.
type Any = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const fields = (kind: EventKind, rest: Partial<NormalizedFields> = {}): NormalizedFields => ({
  kind,
  actor: null,
  message: null,
  amount: null,
  data: {},
  ...rest,
});

function twitchActor(e: Any, prefix = "user"): EventActor | null {
  const name = e[`${prefix}_name`];
  if (!name && !e[`${prefix}_id`]) {
    return null;
  }
  return { id: e[`${prefix}_id`] ?? null, name: name ?? e[`${prefix}_login`] ?? "", login: e[`${prefix}_login`] ?? undefined };
}

const anonymous: EventActor = { id: null, name: "Anonymous" };
const tier = (value: unknown) => (value === "3000" ? 3 : value === "2000" ? 2 : value === "1000" ? 1 : value === "prime" ? "prime" : null);
const phase = (type: string) => type.split(".").pop() ?? "";

export function normalizeTwitch(type: string, e: Any): NormalizedFields {
  switch (type) {
    case "channel.chat.message": {
      const actor = twitchActor(e, "chatter_user");
      if (actor) {
        actor.badges = Array.isArray(e.badges) ? e.badges.map((badge: Any) => String(badge.set_id)) : [];
      }
      return fields("chat.message", {
        actor,
        message: e.message?.text ?? "",
        data: { messageId: e.message_id, color: e.color || null, replyTo: e.reply?.parent_message_id ?? null, bits: e.cheer?.bits ?? null },
      });
    }
    case "channel.chat.notification":
      return fields("chat.notification", {
        actor: e.chatter_is_anonymous ? anonymous : twitchActor(e, "chatter_user"),
        message: e.message?.text || null,
        data: { noticeType: e.notice_type, systemMessage: e.system_message },
      });
    case "channel.chat_settings.update":
      return fields("chat.settings", { data: { ...e } });
    case "channel.follow":
      return fields("follow", { actor: twitchActor(e), occurredAt: e.followed_at });
    case "channel.subscribe":
      return fields("subscription", { actor: twitchActor(e), data: { tier: tier(e.tier), isGift: Boolean(e.is_gift) } });
    case "channel.subscription.message":
      return fields("subscription", {
        actor: twitchActor(e),
        message: e.message?.text || null,
        data: { tier: tier(e.tier), months: e.cumulative_months ?? null, streak: e.streak_months ?? null, isResub: true },
      });
    case "channel.subscription.gift":
      return fields("subscription.gift", {
        actor: e.is_anonymous ? anonymous : twitchActor(e),
        data: { tier: tier(e.tier), count: e.total ?? 1, cumulative: e.cumulative_total ?? null },
      });
    case "channel.subscription.end":
      return fields("subscription.end", { actor: twitchActor(e), data: { tier: tier(e.tier) } });
    case "channel.cheer":
      return fields("tip", {
        actor: e.is_anonymous ? anonymous : twitchActor(e),
        message: e.message || null,
        amount: { value: e.bits, currency: "BITS", display: `${e.bits} ${e.bits === 1 ? "bit" : "bits"}` },
        data: { source: "cheer" },
      });
    case "channel.raid":
      return fields("raid", { actor: twitchActor(e, "from_broadcaster_user"), data: { viewers: e.viewers ?? 0 } });
    case "channel.channel_points_custom_reward_redemption.add":
    case "channel.channel_points_custom_reward_redemption.update":
      return fields("redemption", {
        actor: twitchActor(e),
        message: e.user_input || null,
        data: { reward: { id: e.reward?.id, title: e.reward?.title, cost: e.reward?.cost }, status: e.status, phase: type.endsWith("add") ? "add" : "update" },
        occurredAt: e.redeemed_at,
      });
    case "channel.charity_campaign.donate": {
      const value = Number(e.amount?.value ?? 0) / 10 ** Number(e.amount?.decimal_places ?? 0);
      const currency = e.amount?.currency ?? "USD";
      return fields("tip", {
        actor: twitchActor(e),
        amount: { value, currency, display: formatMoney(value, currency) },
        data: { source: "charity", charity: e.charity_name },
      });
    }
    case "channel.raid.outgoing":
      return fields("raid", { data: { ...e } });
    case "stream.online":
      return fields("stream.online", { data: { type: e.type }, occurredAt: e.started_at });
    case "stream.offline":
      return fields("stream.offline");
    case "channel.update":
      return fields("stream.update", { data: { title: e.title, category: e.category_name, language: e.language } });
    case "channel.ad_break.begin":
      return fields("ad_break", { data: { durationSeconds: e.duration_seconds, automatic: e.is_automatic } });
  }
  const family = type.split(".")[1] ?? "";
  if (family === "hype_train") {
    return fields("hype_train", { data: { phase: phase(type), level: e.level ?? null, total: e.total ?? null, goal: e.goal ?? null } });
  }
  if (family === "poll") {
    return fields("poll", { data: { phase: phase(type), id: e.id, title: e.title, choices: e.choices ?? [] } });
  }
  if (family === "prediction") {
    return fields("prediction", { data: { phase: phase(type), id: e.id, title: e.title, outcomes: e.outcomes ?? [] } });
  }
  if (family === "goal") {
    return fields("goal", { data: { phase: phase(type), type: e.type, current: e.current_amount, target: e.target_amount, description: e.description } });
  }
  if (family === "charity_campaign") {
    return fields("charity", { data: { phase: phase(type), name: e.charity_name } });
  }
  if (family === "shoutout") {
    return fields("shoutout", { data: { direction: phase(type), ...e } });
  }
  return fields("other", { data: { type } });
}

export function normalizeYouTube(m: Any): NormalizedFields {
  const snippet = (m.snippet ?? {}) as Any;
  const author = m.authorDetails as Any | undefined;
  const actor: EventActor | null = author
    ? {
        id: author.channelId ?? null,
        name: author.displayName ?? "",
        avatarUrl: author.profileImageUrl ?? undefined,
        badges: [
          author.isChatOwner && "owner",
          author.isChatModerator && "moderator",
          author.isChatSponsor && "member",
          author.isVerified && "verified",
        ].filter(Boolean) as string[],
      }
    : null;
  const occurredAt = snippet.publishedAt;
  const money = (details: Any | undefined, source: string): NormalizedFields =>
    fields("tip", {
      actor,
      occurredAt,
      message: details?.userComment || null,
      amount: details
        ? { value: Number(details.amountMicros ?? 0) / 1_000_000, currency: details.currency ?? "USD", display: details.amountDisplayString ?? "" }
        : null,
      data: { source, tier: details?.tier ?? null, sticker: details?.superStickerMetadata?.altText ?? undefined },
    });

  switch (snippet.type) {
    case "textMessageEvent":
      return fields("chat.message", { actor, occurredAt, message: snippet.displayMessage ?? "", data: { messageId: m.id } });
    case "superChatEvent":
      return money(snippet.superChatDetails, "super_chat");
    case "superStickerEvent":
      return money(snippet.superStickerDetails, "super_sticker");
    case "newSponsorEvent":
      return fields("subscription", {
        actor,
        occurredAt,
        data: { tier: snippet.newSponsorDetails?.memberLevelName ?? null, isUpgrade: Boolean(snippet.newSponsorDetails?.isUpgrade) },
      });
    case "memberMilestoneChatEvent":
      return fields("subscription", {
        actor,
        occurredAt,
        message: snippet.memberMilestoneChatDetails?.userComment || null,
        data: { tier: snippet.memberMilestoneChatDetails?.memberLevelName ?? null, months: snippet.memberMilestoneChatDetails?.memberMonth ?? null, isResub: true },
      });
    case "membershipGiftingEvent":
      return fields("subscription.gift", {
        actor,
        occurredAt,
        data: { tier: snippet.membershipGiftingDetails?.giftMembershipsLevelName ?? null, count: snippet.membershipGiftingDetails?.giftMembershipsCount ?? 1 },
      });
    case "giftMembershipReceivedEvent":
      return fields("subscription", {
        actor,
        occurredAt,
        data: { tier: snippet.giftMembershipReceivedDetails?.memberLevelName ?? null, isGift: true, gifterChannelId: snippet.giftMembershipReceivedDetails?.gifterChannelId ?? null },
      });
    case "messageDeletedEvent":
      return fields("chat.message.deleted", { occurredAt, data: { messageId: snippet.messageDeletedDetails?.deletedMessageId ?? null } });
    case "userBannedEvent":
      return fields("moderation", {
        occurredAt,
        data: { action: "ban", type: snippet.userBannedDetails?.banType, durationSeconds: snippet.userBannedDetails?.banDurationSeconds ?? null, target: snippet.userBannedDetails?.bannedUserDetails?.displayName },
      });
    case "chatEndedEvent":
      return fields("stream.offline", { occurredAt, data: { reason: "chat_ended" } });
    case "pollEvent":
      return fields("poll", { occurredAt, data: { ...(snippet.pollDetails ?? {}) } });
    case "giftEvent":
      return fields("tip", { actor, occurredAt, data: { source: "gift", ...(snippet.giftEventDetails ?? {}) } });
  }
  return fields("other", { actor, occurredAt, message: snippet.displayMessage ?? null, data: { type: snippet.type } });
}

function formatMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}

/** An X user object as delivered in Activity API payloads ({ data: { id, username, name, … } }). */
function xActor(user: Any | undefined, extraBadges: string[] = []): EventActor | null {
  const u = (user?.data ?? user) as Any | undefined;
  if (!u?.id && !u?.username) {
    return null;
  }
  return {
    id: u.id ?? null,
    name: u.name || u.username || "",
    login: u.username ?? undefined,
    avatarUrl: xAvatar(u.profile_image_url),
    // X verification: "verified" (Premium blue), "verified-business" (gold) or "verified-government" (gray).
    badges: [...extraBadges, xVerifiedBadge(u)].filter(Boolean) as string[],
  };
}

function xVerifiedBadge(u: Any) {
  if (u.verified_type === "business") {
    return "verified-business";
  }
  if (u.verified_type === "government") {
    return "verified-government";
  }
  return u.verified || (u.verified_type && u.verified_type !== "none") ? "verified" : null;
}

/** X sends the 48x48 "_normal" avatar; the "_400x400" variant of the same image is sharp on overlays. */
function xAvatar(url: unknown) {
  return typeof url === "string" ? url.replace(/_normal(\.[a-z]+)$/i, "_400x400$1") : undefined;
}

/** X Activity API events (broadcast chat, broadcast lifecycle, follows, subscriptions). */
export function normalizeX(type: string, p: Any): NormalizedFields {
  switch (type) {
    case "broadcast.chat":
      return fields("chat.message", {
        actor: xActor(p.author, [p.is_moderator && "moderator", p.is_subscriber && "subscriber"].filter(Boolean) as string[]),
        message: p.message ?? "",
        data: { messageId: p.message_id, broadcastId: p.broadcast_id, replyTo: p.reply_to ?? null },
      });
    case "broadcast.chat.remove":
      return fields("chat.message.deleted", { data: { messageId: p.message_id, broadcastId: p.broadcast_id } });
    case "broadcast.start":
      return fields("stream.online", { data: { broadcastId: p.broadcast_id, title: p.title ?? null, language: p.language ?? null } });
    case "broadcast.end":
      return fields("stream.offline", { data: { broadcastId: p.broadcast_id, durationMs: p.duration_ms ?? null } });
    case "follow.follow":
      return fields("follow", { actor: xActor(p.source) });
    case "subscriptions.subscribe":
      return fields("subscription", { actor: xActor(p.source), data: { tier: null } });
    default:
      return fields("other", { data: { type } });
  }
}
