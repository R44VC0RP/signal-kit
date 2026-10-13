import type { EventKind, EventPlatform, SignalKitEvent } from "@/lib/events/types";

/**
 * Realistic sample events for previews and test alerts. Shared by the customizer (in the
 * browser) and the test-alert API, so it has no server imports. Every sample is marked
 * `test: true`; overlays show it like a real event, apps can ignore it.
 */

export type SampleKind = "follow" | "subscription" | "subscription.gift" | "tip" | "raid" | "redemption" | "chat.message";

export const SAMPLE_BUTTONS: { kind: SampleKind; label: string }[] = [
  { kind: "follow", label: "Follow" },
  { kind: "subscription", label: "Sub" },
  { kind: "subscription.gift", label: "Gift subs" },
  { kind: "tip", label: "Tip" },
  { kind: "raid", label: "Raid" },
  { kind: "redemption", label: "Redemption" },
  { kind: "chat.message", label: "Chat" },
];

/** Twitch's global badge images (from Helix /chat/badges/global), so previews show real badges. */
const TWITCH_BADGE = {
  moderator: { set: "moderator", id: "1", title: "Moderator", url: "https://static-cdn.jtvnw.net/badges/v1/3267646d-33f0-4b17-b3df-f923a41db1d0/3" },
  subscriber: { set: "subscriber", id: "0", title: "Subscriber", url: "https://static-cdn.jtvnw.net/badges/v1/5d9f2208-5dd8-11e7-8513-2ff4adfae661/3" },
  vip: { set: "vip", id: "1", title: "VIP", url: "https://static-cdn.jtvnw.net/badges/v1/b817aba4-fad8-49e2-b88a-7cc744dfa6ec/3" },
  partner: { set: "partner", id: "1", title: "Verified", url: "https://static-cdn.jtvnw.net/badges/v1/d12a2e27-16f6-41d0-ab77-b780518f00a3/3" },
};

const PEOPLE: { name: string; platform: EventPlatform; badges: string[]; badgeImages?: (typeof TWITCH_BADGE)[keyof typeof TWITCH_BADGE][] }[] = [
  { name: "mira.codes", platform: "youtube", badges: ["member"] },
  { name: "PixelPilot", platform: "twitch", badges: ["subscriber"], badgeImages: [TWITCH_BADGE.subscriber] },
  { name: "devon_k", platform: "x", badges: ["verified"] },
  { name: "lowlatency", platform: "twitch", badges: ["moderator", "subscriber"], badgeImages: [TWITCH_BADGE.moderator, TWITCH_BADGE.subscriber] },
  { name: "Ana Ruiz", platform: "youtube", badges: ["moderator", "verified"] },
  { name: "nightowl", platform: "x", badges: ["verified-business"] },
  { name: "StreamerGuild", platform: "twitch", badges: ["partner", "vip"], badgeImages: [TWITCH_BADGE.vip, TWITCH_BADGE.partner] },
];

const CHAT = [
  "that clutch was insane",
  "first time catching you live!",
  "does the SDK work in Bun?",
  "GG 👏",
  "how long have you been streaming today?",
  "the new overlay looks so clean",
  "lol that jump",
  "hello from Lisbon 👋",
];

const TIP_MESSAGES = ["Take my money.", "For the coffee fund ☕", "Love the stream!", null];

let counter = 0;
const pick = <T,>(items: T[], seed: number) => items[seed % items.length];

export function sampleEvent(kind: SampleKind, seed = Math.floor(Math.random() * 1000)): SignalKitEvent & { test: true } {
  const person = pick(PEOPLE, seed);
  // Platforms differ in what they support: a raid is a Twitch thing, Super Chats are YouTube.
  const platform: EventPlatform = kind === "raid" || kind === "redemption" ? "twitch" : person.platform;
  const now = new Date().toISOString();
  const base = {
    v: 2 as const,
    id: `test_${Date.now().toString(36)}_${(counter++).toString(36)}`,
    kind: kind as EventKind,
    platform,
    channel: { connectionId: "test", id: "test", name: "You" },
    actor: {
      id: `sample-${seed}`,
      name: person.name,
      login: person.name.toLowerCase().replace(/[^a-z0-9_]/g, ""),
      badges: person.badges,
      badgeImages: platform === "twitch" ? person.badgeImages : undefined,
    },
    message: null as string | null,
    amount: null as SignalKitEvent["amount"],
    data: {} as Record<string, unknown>,
    occurredAt: now,
    receivedAt: now,
    test: true as const,
  };
  switch (kind) {
    case "follow":
      break;
    case "subscription":
      base.data = platform === "youtube" ? { months: 3, level: "Member" } : { tier: 1, months: 6 };
      base.message = platform === "youtube" ? null : "6 months and counting!";
      break;
    case "subscription.gift":
      base.data = { count: 5, tier: 1 };
      break;
    case "tip": {
      const message = pick(TIP_MESSAGES, seed);
      base.message = message;
      if (platform === "twitch") {
        base.amount = { value: 500, currency: "BITS", display: "500 bits" };
        base.data = { source: "cheer" };
      } else {
        base.amount = { value: 20, currency: "USD", display: "$20.00" };
        base.data = { source: platform === "youtube" ? "super_chat" : "tip" };
      }
      break;
    }
    case "raid":
      base.data = { viewers: 128 };
      break;
    case "redemption":
      base.data = { reward: { title: "Hydrate!", cost: 500 } };
      base.message = null;
      break;
    case "chat.message":
      base.message = pick(CHAT, seed + counter);
      break;
  }
  return {
    ...base,
    raw: { type: `test.${kind}`, event: {} },
    type: `test.${kind}`,
    provider: platform,
    event: {},
  };
}
