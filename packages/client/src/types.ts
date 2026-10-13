/**
 * Event types for Signal Kit clients.
 * Mirrors src/lib/events/types.ts in the Signal Kit server; keep the two in sync.
 */

export type EventPlatform = "twitch" | "youtube" | "x";

export type EventKind =
  | "chat.message"
  | "chat.message.deleted"
  | "chat.notification"
  | "chat.settings"
  | "follow"
  | "subscription"
  | "subscription.gift"
  | "subscription.end"
  | "tip"
  | "raid"
  | "redemption"
  | "hype_train"
  | "poll"
  | "prediction"
  | "goal"
  | "charity"
  | "shoutout"
  | "ad_break"
  | "moderation"
  | "stream.online"
  | "stream.offline"
  | "stream.update"
  | "other";

/**
 * A chat message split for display: plain text, emotes (Twitch, BTTV, FFZ, 7TV; animated when
 * the emote is; zero-width emotes draw on top of the previous one), cheermotes with their bits
 * and tier colour, and @mentions.
 */
export type MessagePart =
  | { type: "text"; text: string }
  | { type: "emote"; name: string; url: string; animated: boolean; zeroWidth?: boolean; source: "twitch" | "bttv" | "ffz" | "7tv" | "youtube" }
  | { type: "cheer"; name: string; bits: number; url: string; color: string }
  | { type: "mention"; text: string };

export type EventActor = {
  /** The platform's id for the person (Twitch user id, YouTube channel id, X user id). */
  id: string | null;
  /** Display name as shown on the platform. */
  name: string;
  /** Login / handle when the platform has one. */
  login?: string;
  avatarUrl?: string;
  /** Platform roles or badges, e.g. "moderator", "subscriber", "member", "owner", "verified". */
  badges?: string[];
  /** Official badge images where the platform provides them (Twitch: moderator, VIP, the channel's sub badges…). */
  badgeImages?: { set: string; id: string; title: string; url: string }[];
};

export type EventAmount = {
  /** Numeric value in `currency` units (Bits count for Twitch cheers). */
  value: number;
  /** ISO currency code, or "BITS" for Twitch Bits. */
  currency: string;
  /** Human-readable amount, e.g. "$20.00" or "500 bits". */
  display: string;
};

export type SignalKitEvent = {
  /** Version of this envelope format. */
  v: 2;
  /** Sortable, unique id. Pass the last one you saw as `since` to replay what you missed. */
  id: string;
  kind: EventKind;
  platform: EventPlatform;
  /** Which connected account this came from. */
  channel: { connectionId: string; id: string; name: string };
  actor: EventActor | null;
  /** Free text attached to the event (chat text, cheer message, Super Chat comment…). */
  message: string | null;
  /** `message` split into text, emotes and cheermotes for display, when known. */
  messageParts?: MessagePart[];
  /** Money-like value for tips, Bits, Super Chats and charity donations. */
  amount: EventAmount | null;
  /** Kind-specific details (tier, months, viewers, reward, level…). */
  data: Record<string, unknown>;
  occurredAt: string;
  receivedAt: string;
  /** The original platform payload, untouched. */
  raw: { type: string; event: unknown };

  // Compatibility with pre-v2 clients, which dispatched on the raw platform type.
  /** @deprecated Use `kind`; this is the raw platform type (e.g. "channel.cheer"). */
  type: string;
  /** @deprecated Use `platform`. */
  provider: EventPlatform;
  /** @deprecated Use `raw.event`. */
  event: unknown;
};
