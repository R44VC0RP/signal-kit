/**
 * Chat bot configuration: custom commands, built-in commands, timed messages, spam filters,
 * loyalty points (with a store), automatic stream markers and quotes. Pure (no server imports)
 * so the dashboard and the server share types, defaults and validation.
 */

export const ROLES = ["everyone", "subscriber", "vip", "moderator", "broadcaster"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = { everyone: "Everyone", subscriber: "Subscribers", vip: "VIPs", moderator: "Moderators", broadcaster: "Only me" };

export type BotCommand = { id: string; name: string; response: string; permission: Role; cooldownSec: number; userCooldownSec: number; enabled: boolean; uses: number };
export type BotTimer = { id: string; message: string; intervalMin: number; minLines: number; enabled: boolean };
export type StoreItem = { id: string; name: string; cost: number; enabled: boolean };
export type Quote = { id: number; text: string; by: string; at: string };

export const BUILTINS = [
  ["uptime", "!uptime", "How long you've been live"],
  ["followage", "!followage", "How long the viewer has followed"],
  ["points", "!points", "The viewer's loyalty points"],
  ["top", "!top", "Top 5 by points"],
  ["redeem", "!redeem <item>", "Spend points in your store"],
  ["shoutout", "!so @name", "Shoutout (moderators)"],
  ["clip", "!clip", "Clip the last 30 seconds"],
  ["marker", "!marker [note]", "Stream marker (moderators)"],
  ["quote", "!quote [n] · !addquote", "Quotes (moderators add)"],
  ["commands", "!commands", "List the commands"],
] as const;
export type Builtin = (typeof BUILTINS)[number][0];

export type BotConfig = {
  enabled: boolean;
  /** "broadcaster" or the id of a connected Twitch bot account. */
  sender: string;
  commands: BotCommand[];
  builtins: Record<Builtin, boolean>;
  /** Minimum role for !clip. */
  clipPermission: Role;
  timers: BotTimer[];
  moderation: {
    enabled: boolean;
    /** This role and above are never filtered. */
    exempt: Role;
    links: boolean;
    caps: boolean;
    capsPercent: number;
    symbols: boolean;
    emotes: boolean;
    maxEmotes: number;
    length: boolean;
    maxLength: number;
    words: string;
    action: "delete" | "timeout";
    timeoutSec: number;
    warn: boolean;
  };
  loyalty: {
    enabled: boolean;
    name: string;
    perMessage: number;
    messageCooldownSec: number;
    /** Points per minute watched (Twitch viewers, checked every 5 minutes while live). */
    perMinute: number;
    bonusFollow: number;
    bonusSub: number;
    /** Per 100 bits. */
    bonusCheer: number;
    bonusRaid: number;
    store: StoreItem[];
  };
  markers: { enabled: boolean; raid: boolean; hypeTrain: boolean; giftMin: number; cheerMin: number };
  quotes: Quote[];
};

const id = () => Math.random().toString(36).slice(2, 10);

export function defaultBotConfig(): BotConfig {
  return {
    enabled: false,
    sender: "broadcaster",
    commands: [
      { id: id(), name: "discord", response: "Join the community: https://discord.gg/your-invite", permission: "everyone", cooldownSec: 30, userCooldownSec: 0, enabled: true, uses: 0 },
      { id: id(), name: "lurk", response: "{user} is lurking. Enjoy the stream!", permission: "everyone", cooldownSec: 5, userCooldownSec: 60, enabled: true, uses: 0 },
    ],
    builtins: { uptime: true, followage: true, points: true, top: true, redeem: true, shoutout: true, clip: true, marker: true, quote: true, commands: true },
    clipPermission: "subscriber",
    timers: [{ id: id(), message: "Enjoying the stream? Follow so you don't miss the next one!", intervalMin: 20, minLines: 10, enabled: true }],
    moderation: {
      enabled: false,
      exempt: "vip",
      links: true,
      caps: true,
      capsPercent: 70,
      symbols: false,
      emotes: false,
      maxEmotes: 15,
      length: false,
      maxLength: 400,
      words: "",
      action: "delete",
      timeoutSec: 10,
      warn: true,
    },
    loyalty: {
      enabled: true,
      name: "points",
      perMessage: 2,
      messageCooldownSec: 60,
      perMinute: 1,
      bonusFollow: 50,
      bonusSub: 500,
      bonusCheer: 10,
      bonusRaid: 100,
      store: [
        { id: id(), name: "Hydrate", cost: 300, enabled: true },
        { id: id(), name: "Spin the wheel", cost: 1000, enabled: true },
      ],
    },
    markers: { enabled: true, raid: true, hypeTrain: true, giftMin: 5, cheerMin: 1000 },
    quotes: [],
  };
}

// ---- Validation -----------------------------------------------------------------------------

const clamp = (value: unknown, min: number, max: number, fallback: number) => (typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback);
const text = (value: unknown, max: number, fallback = "") => (typeof value === "string" ? value.slice(0, max) : fallback);
const bool = (value: unknown, fallback: boolean) => (typeof value === "boolean" ? value : fallback);
const role = (value: unknown, fallback: Role): Role => ((ROLES as readonly string[]).includes(value as string) ? (value as Role) : fallback);
const list = (value: unknown, max: number) => (Array.isArray(value) ? value.slice(0, max) : []);
const record = (value: unknown) => (value && typeof value === "object" ? (value as Record<string, unknown>) : {});

/** Command names: letters, numbers, _ and -, without the "!". */
export function commandName(value: unknown) {
  return text(value, 30)
    .trim()
    .replace(/^!+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");
}

/** Untrusted input (API body, stored JSON) → a complete, valid config. */
export function sanitizeBotConfig(input: unknown): BotConfig {
  const d = defaultBotConfig();
  const v = record(input);
  const mod = record(v.moderation);
  const loy = record(v.loyalty);
  const mark = record(v.markers);
  const builtins = record(v.builtins);
  const seen = new Set<string>();
  return {
    enabled: bool(v.enabled, d.enabled),
    sender: text(v.sender, 36, "broadcaster") || "broadcaster",
    commands: list(v.commands ?? d.commands, 200)
      .map((raw) => {
        const c = record(raw);
        return {
          id: text(c.id, 20) || id(),
          name: commandName(c.name),
          response: text(c.response, 450).trim(),
          permission: role(c.permission, "everyone"),
          cooldownSec: clamp(c.cooldownSec, 0, 3600, 5),
          userCooldownSec: clamp(c.userCooldownSec, 0, 3600, 0),
          enabled: bool(c.enabled, true),
          uses: clamp(c.uses, 0, 1e9, 0),
        };
      })
      .filter((c) => c.name && !seen.has(c.name) && (seen.add(c.name), true)),
    builtins: Object.fromEntries(BUILTINS.map(([key]) => [key, bool(builtins[key], d.builtins[key])])) as BotConfig["builtins"],
    clipPermission: role(v.clipPermission, d.clipPermission),
    timers: list(v.timers ?? d.timers, 30)
      .map((raw) => {
        const t = record(raw);
        return { id: text(t.id, 20) || id(), message: text(t.message, 450).trim(), intervalMin: clamp(t.intervalMin, 5, 240, 20), minLines: clamp(t.minLines, 0, 500, 10), enabled: bool(t.enabled, true) };
      })
      .filter((t) => t.message),
    moderation: {
      enabled: bool(mod.enabled, d.moderation.enabled),
      exempt: role(mod.exempt, d.moderation.exempt),
      links: bool(mod.links, d.moderation.links),
      caps: bool(mod.caps, d.moderation.caps),
      capsPercent: clamp(mod.capsPercent, 30, 100, d.moderation.capsPercent),
      symbols: bool(mod.symbols, d.moderation.symbols),
      emotes: bool(mod.emotes, d.moderation.emotes),
      maxEmotes: clamp(mod.maxEmotes, 1, 100, d.moderation.maxEmotes),
      length: bool(mod.length, d.moderation.length),
      maxLength: clamp(mod.maxLength, 50, 500, d.moderation.maxLength),
      words: text(mod.words, 4000),
      action: mod.action === "timeout" ? "timeout" : "delete",
      timeoutSec: clamp(mod.timeoutSec, 1, 1_209_600, d.moderation.timeoutSec),
      warn: bool(mod.warn, d.moderation.warn),
    },
    loyalty: {
      enabled: bool(loy.enabled, d.loyalty.enabled),
      name: text(loy.name, 24).trim() || "points",
      perMessage: clamp(loy.perMessage, 0, 1000, d.loyalty.perMessage),
      messageCooldownSec: clamp(loy.messageCooldownSec, 0, 3600, d.loyalty.messageCooldownSec),
      perMinute: clamp(loy.perMinute, 0, 1000, d.loyalty.perMinute),
      bonusFollow: clamp(loy.bonusFollow, 0, 1e6, d.loyalty.bonusFollow),
      bonusSub: clamp(loy.bonusSub, 0, 1e6, d.loyalty.bonusSub),
      bonusCheer: clamp(loy.bonusCheer, 0, 1e6, d.loyalty.bonusCheer),
      bonusRaid: clamp(loy.bonusRaid, 0, 1e6, d.loyalty.bonusRaid),
      store: list(loy.store ?? d.loyalty.store, 50)
        .map((raw) => {
          const s = record(raw);
          return { id: text(s.id, 20) || id(), name: text(s.name, 60).trim(), cost: clamp(s.cost, 1, 1e9, 100), enabled: bool(s.enabled, true) };
        })
        .filter((s) => s.name),
    },
    markers: {
      enabled: bool(mark.enabled, d.markers.enabled),
      raid: bool(mark.raid, d.markers.raid),
      hypeTrain: bool(mark.hypeTrain, d.markers.hypeTrain),
      giftMin: clamp(mark.giftMin, 0, 1000, d.markers.giftMin),
      cheerMin: clamp(mark.cheerMin, 0, 1_000_000, d.markers.cheerMin),
    },
    quotes: list(v.quotes, 1000)
      .map((raw) => {
        const q = record(raw);
        return { id: clamp(q.id, 1, 1e9, 1), text: text(q.text, 300).trim(), by: text(q.by, 60), at: text(q.at, 40) };
      })
      .filter((q) => q.text),
  };
}

/** Roles a Twitch chatter has, from their badges. */
export function roleOf(badges: string[] | undefined): Role {
  const set = new Set(badges ?? []);
  return set.has("broadcaster") ? "broadcaster" : set.has("moderator") ? "moderator" : set.has("vip") ? "vip" : set.has("subscriber") || set.has("founder") ? "subscriber" : "everyone";
}

export function atLeast(have: Role, need: Role) {
  return ROLES.indexOf(have) >= ROLES.indexOf(need);
}

/** Which spam rule a message breaks, if any (pure, for tests and the server). */
export function spamReason(message: string, emoteCount: number, m: BotConfig["moderation"]): string | null {
  const textOnly = message.trim();
  if (m.links && /(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]{2,}\.(?:com|net|org|gg|tv|io|ly|me|co|xyz|ru|info|link|app)\b/i.test(textOnly)) {
    return "links";
  }
  const letters = textOnly.replace(/[^a-z]/gi, "");
  if (m.caps && letters.length >= 12 && (letters.replace(/[^A-Z]/g, "").length / letters.length) * 100 >= m.capsPercent) {
    return "caps";
  }
  if (m.symbols && textOnly.length >= 12 && textOnly.replace(/[\p{L}\p{N}\s]/gu, "").length / textOnly.length > 0.5) {
    return "symbols";
  }
  if (m.emotes && emoteCount > m.maxEmotes) {
    return "emotes";
  }
  if (m.length && textOnly.length > m.maxLength) {
    return "length";
  }
  const words = m.words
    .split(/[\n,]/)
    .map((word) => word.trim().toLowerCase())
    .filter(Boolean);
  if (words.length && words.some((word) => textOnly.toLowerCase().includes(word))) {
    return "words";
  }
  return null;
}
