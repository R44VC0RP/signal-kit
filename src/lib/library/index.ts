import type { AlertKind } from "@/lib/overlays/settings";
import artJson from "./art.json";
import soundsJson from "./sounds.json";

/**
 * Signal Kit's media library: alert art and sounds we're allowed to ship. Art is Google's Noto
 * animated emoji (CC BY 4.0, linked from Google's CDN, which is how Google offers them for
 * embedding), Microsoft's Fluent 3D emoji (MIT) and our own art; sounds are CC0 (Kenney,
 * Juhani Junkala, JaggedStone). Every item keeps its license, source and credit.
 */

export type LibraryArt = {
  id: string;
  name: string;
  category: string;
  url: string;
  animated: boolean;
  license: string;
  attribution: string;
  sourceUrl: string;
  suggestedFor: AlertKind[];
};

export type LibrarySound = {
  id: string;
  name: string;
  category: string;
  file: string;
  durationSec: number;
  license: string;
  source: string;
  sourceUrl: string;
  suggestedFor: AlertKind[];
};

export const LIBRARY_ART = artJson as LibraryArt[];
export const LIBRARY_SOUNDS = soundsJson as LibrarySound[];

export const ART_CATEGORIES: { id: string; name: string }[] = [
  { id: "signal-kit", name: "Signal Kit" },
  { id: "celebrate", name: "Celebrate" },
  { id: "love", name: "Love" },
  { id: "hype", name: "Hype" },
  { id: "money", name: "Money" },
  { id: "stars", name: "Stars" },
  { id: "faces", name: "Faces" },
  { id: "gaming", name: "Gaming" },
  { id: "misc", name: "More" },
];

export const SOUND_CATEGORIES: { id: string; name: string }[] = [
  { id: "jingle", name: "Jingles" },
  { id: "chime", name: "Chimes" },
  { id: "coins", name: "Coins" },
  { id: "sparkle", name: "Sparkles" },
  { id: "pop", name: "Pops" },
  { id: "hype", name: "Hype" },
  { id: "retro", name: "Retro" },
];

/** The credit line shown wherever a piece of art appears in the dashboard. */
export function artCredit(url: string) {
  return LIBRARY_ART.find((item) => item.url === url)?.attribution ?? null;
}

export function soundName(file: string) {
  return LIBRARY_SOUNDS.find((item) => item.file === file)?.name ?? null;
}

const art = (id: string) => LIBRARY_ART.find((item) => item.id === id)?.url ?? "";
const sound = (id: string) => LIBRARY_SOUNDS.find((item) => item.id === id)?.file ?? "";

/** Matched art + sound for every alert, applied in one click. Empty means Signal Kit's default. */
export type AlertPack = { id: string; name: string; description: string; media: Record<AlertKind, { image: string; sound: string }> };

export const ALERT_PACKS: AlertPack[] = [
  {
    id: "signal-kit",
    name: "Signal Kit",
    description: "Our glossy icons and original sounds.",
    media: Object.fromEntries(["follow", "subscription", "subscription.gift", "cheer", "tip", "raid", "redemption"].map((kind) => [kind, { image: "", sound: "" }])) as AlertPack["media"],
  },
  {
    id: "animated-emoji",
    name: "Animated emoji",
    description: "Google's animated Noto emoji with upbeat jingles.",
    media: {
      follow: { image: art("noto/growing-heart"), sound: sound("chimes/sparkle-rise") },
      subscription: { image: art("noto/star-struck"), sound: sound("jingles/sax-victory") },
      "subscription.gift": { image: art("noto/wrapped-gift"), sound: sound("jingles/pizzicato-tada") },
      cheer: { image: art("noto/gem-stone"), sound: sound("sparkles/glitter-burst") },
      tip: { image: art("noto/money-with-wings"), sound: sound("coins/coin-cascade") },
      raid: { image: art("noto/rocket"), sound: sound("hype/riser-drop") },
      redemption: { image: art("noto/admission-tickets"), sound: sound("sparkles/magic-twinkle") },
    },
  },
  {
    id: "party",
    name: "Party",
    description: "Confetti, fireworks and steel drums.",
    media: {
      follow: { image: art("noto/party-popper"), sound: sound("jingles/steel-drum-hop") },
      subscription: { image: art("noto/partying-face"), sound: sound("jingles/steel-drum-party") },
      "subscription.gift": { image: art("noto/pinata"), sound: sound("jingles/pizzicato-tada") },
      cheer: { image: art("noto/confetti-ball"), sound: sound("jingles/steel-drum-cheer") },
      tip: { image: art("noto/popping-cork"), sound: sound("coins/coin-burst") },
      raid: { image: art("fluent/fireworks"), sound: sound("jingles/band-hit-fanfare") },
      redemption: { image: art("noto/mirror-ball"), sound: sound("sparkles/fairy-dust") },
    },
  },
  {
    id: "3d-emoji",
    name: "3D emoji",
    description: "Microsoft's Fluent 3D emoji with clean chimes.",
    media: {
      follow: { image: art("fluent/sparkling-heart"), sound: sound("chimes/two-note-ding") },
      subscription: { image: art("fluent/glowing-star"), sound: sound("chimes/big-bell") },
      "subscription.gift": { image: art("fluent/wrapped-gift"), sound: sound("sparkles/spell-shimmer") },
      cheer: { image: art("fluent/gem-stone"), sound: sound("chimes/crystal-ping") },
      tip: { image: art("fluent/money-bag"), sound: sound("coins/coin-purse") },
      raid: { image: art("fluent/rocket"), sound: sound("hype/rising-sweep") },
      redemption: { image: art("fluent/ticket"), sound: sound("chimes/rising-confirm") },
    },
  },
  {
    id: "retro",
    name: "Retro arcade",
    description: "Game art and 8-bit sound effects.",
    media: {
      follow: { image: art("fluent/joystick"), sound: sound("retro/three-tone-zap") },
      subscription: { image: art("fluent/trophy"), sound: sound("retro/8bit-level-up") },
      "subscription.gift": { image: art("fluent/alien-monster"), sound: sound("retro/8bit-victory") },
      cheer: { image: art("fluent/gem-stone"), sound: sound("retro/power-up") },
      tip: { image: art("fluent/coin"), sound: sound("retro/arcade-coin") },
      raid: { image: art("fluent/crossed-swords"), sound: sound("retro/charge-up") },
      redemption: { image: art("fluent/video-game"), sound: sound("retro/power-up") },
    },
  },
];
