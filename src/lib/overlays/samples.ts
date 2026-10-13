import type { EventKind, EventPlatform, MessagePart, SignalKitEvent } from "@/lib/events/types";

/**
 * Realistic sample events for previews and test alerts. Shared by the customizer (in the
 * browser) and the test-alert API, so it has no server imports. Every sample is marked
 * `test: true`; overlays show it like a real event, apps can ignore it.
 */

export type SampleKind = "follow" | "subscription" | "subscription.gift" | "cheer" | "tip" | "raid" | "redemption" | "chat.message";

export const SAMPLE_BUTTONS: { kind: SampleKind; label: string }[] = [
  { kind: "follow", label: "Follow" },
  { kind: "subscription", label: "Sub" },
  { kind: "subscription.gift", label: "Gift subs" },
  { kind: "cheer", label: "Cheer" },
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

const twitchEmote = (name: string, id: string, animated = false): MessagePart => ({
  type: "emote",
  name,
  url: `https://static-cdn.jtvnw.net/emoticons/v2/${id}/${animated ? "animated" : "static"}/dark/3.0`,
  animated,
  source: "twitch",
});
const sevenTv = (name: string, id: string, animated = false): MessagePart => ({ type: "emote", name, url: `https://cdn.7tv.app/emote/${id}/4x.webp`, animated, source: "7tv" });
const t = (text: string): MessagePart => ({ type: "text", text });

/** Sample chat lines; Twitch ones include real Twitch and 7TV emotes so previews show them. */
const CHAT: { text: string; parts?: MessagePart[] }[] = [
  { text: "that clutch was insane LUL", parts: [t("that clutch was insane "), twitchEmote("LUL", "425618")] },
  { text: "first time catching you live! HeyGuys", parts: [t("first time catching you live! "), twitchEmote("HeyGuys", "30259")] },
  { text: "does the SDK work in Bun?" },
  { text: "GG Clap Clap", parts: [t("GG "), sevenTv("Clap", "01FGW8E11800064MEQW00DPD11", true), t(" "), sevenTv("Clap", "01FGW8E11800064MEQW00DPD11", true)] },
  { text: "how long have you been streaming today?" },
  { text: "OMEGALUL that jump", parts: [sevenTv("OMEGALUL", "01GDR51Q1R0006171NHFCC48HX"), t(" that jump")] },
  { text: "the new overlay looks so clean Kappa", parts: [t("the new overlay looks so clean "), twitchEmote("Kappa", "25")] },
  { text: "hello from Lisbon 👋" },
  { text: "Kappa Kappa Kappa", parts: [twitchEmote("Kappa", "25"), t(" "), twitchEmote("Kappa", "25"), t(" "), twitchEmote("Kappa", "25")] },
  { text: "LUL LUL", parts: [twitchEmote("LUL", "425618"), t(" "), twitchEmote("LUL", "425618")] },
  { text: "🔥🔥🔥 lets go" },
];

const TIP_MESSAGES = ["Take my money.", "For the coffee fund ☕", "Love the stream!", null];

let counter = 0;
const pick = <T,>(items: T[], seed: number) => items[seed % items.length];

export function sampleEvent(kind: SampleKind, seed = Math.floor(Math.random() * 1000)): SignalKitEvent & { test: true } {
  const person = pick(PEOPLE, seed);
  // Platforms differ in what they support: a raid is a Twitch thing, Super Chats are YouTube.
  // Cheers (Bits) are Twitch; money tips come from YouTube Super Chats and X.
  const platform: EventPlatform =
    kind === "raid" || kind === "redemption" || kind === "cheer" ? "twitch" : kind === "tip" && person.platform === "twitch" ? "youtube" : person.platform;
  const now = new Date().toISOString();
  const base = {
    v: 2 as const,
    id: `test_${Date.now().toString(36)}_${(counter++).toString(36)}`,
    kind: (kind === "cheer" ? "tip" : kind) as EventKind,
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
    case "cheer":
      base.amount = { value: 500, currency: "BITS", display: "500 bits" };
      base.data = { source: "cheer" };
      base.message = "Cheer500 Love the stream!";
      (base as { messageParts?: MessagePart[] }).messageParts = [
        { type: "cheer", name: "Cheer500", bits: 500, url: "https://d3aqoihi2n8ty8.cloudfront.net/actions/cheer/dark/animated/100/3.gif", color: "#9c3ee8" },
        t(" Love the stream!"),
      ];
      break;
    case "tip": {
      base.message = pick(TIP_MESSAGES, seed);
      const value = pick([5, 20, 50], seed);
      base.amount = { value, currency: "USD", display: `$${value.toFixed(2)}` };
      base.data = { source: platform === "youtube" ? "super_chat" : "tip" };
      break;
    }
    case "raid":
      base.data = { viewers: 128 };
      break;
    case "redemption":
      base.data = { reward: { title: "Hydrate!", cost: 500 } };
      base.message = null;
      break;
    case "chat.message": {
      const line = pick(CHAT, seed);
      base.message = line.text;
      // Emote images are Twitch's; other platforms get the plain text.
      if (platform === "twitch" && line.parts) {
        (base as { messageParts?: MessagePart[] }).messageParts = line.parts;
      }
      break;
    }
  }
  return {
    ...base,
    raw: { type: `test.${kind}`, event: {} },
    type: `test.${kind}`,
    provider: platform,
    event: {},
  };
}
