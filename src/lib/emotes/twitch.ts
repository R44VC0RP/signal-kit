import type { MessagePart } from "@/lib/events/types";
import { helixApp } from "@/lib/twitch/helix-app";
import { thirdPartyEmotes } from "./third-party";

/**
 * Turns a Twitch chat message (EventSub fragments) into display parts: Twitch emotes (animated
 * when the emote is), cheermotes with their tier image and colour, and BTTV/FFZ/7TV emotes found
 * in the text. Mirrors what viewers see in Twitch chat.
 */

type Fragment = {
  type?: string;
  text?: string;
  emote?: { id?: string; format?: string[] } | null;
  cheermote?: { prefix?: string; bits?: number; tier?: number } | null;
};

type CheermoteTier = { min_bits: number; id: string; color: string; images: { dark: { animated: Record<string, string>; static: Record<string, string> } } };
type Cheermotes = { data: { prefix: string; tiers: CheermoteTier[] }[] };

const CHEER_TTL_MS = 60 * 60 * 1000;
const cheerCache = new Map<string, { at: number; byPrefix: Map<string, CheermoteTier[]> }>();

async function cheermotes(broadcasterId: string) {
  const cached = cheerCache.get(broadcasterId);
  if (cached && Date.now() - cached.at < CHEER_TTL_MS) {
    return cached.byPrefix;
  }
  const result = await helixApp<Cheermotes>("GET", `/bits/cheermotes?broadcaster_id=${encodeURIComponent(broadcasterId)}`);
  const byPrefix = new Map(result.data.map((entry) => [entry.prefix.toLowerCase(), [...entry.tiers].sort((a, b) => a.min_bits - b.min_bits)]));
  cheerCache.set(broadcasterId, { at: Date.now(), byPrefix });
  return byPrefix;
}

export function twitchEmoteUrl(id: string, animated: boolean) {
  return `https://static-cdn.jtvnw.net/emoticons/v2/${encodeURIComponent(id)}/${animated ? "animated" : "static"}/dark/3.0`;
}

/** Splits plain text into text and third-party emote parts, word by word. */
export function splitThirdParty(text: string, lookup: ((name: string) => ReturnType<Awaited<ReturnType<typeof thirdPartyEmotes>>>) | null): MessagePart[] {
  if (!lookup || !text) {
    return text ? [{ type: "text", text }] : [];
  }
  const parts: MessagePart[] = [];
  let buffer = "";
  for (const token of text.split(/(\s+)/)) {
    const emote = token.trim() ? lookup(token) : null;
    if (emote) {
      if (buffer) {
        parts.push({ type: "text", text: buffer });
        buffer = "";
      }
      parts.push({ type: "emote", name: emote.name, url: emote.url, animated: emote.animated, zeroWidth: emote.zeroWidth || undefined, source: emote.source });
    } else {
      buffer += token;
    }
  }
  if (buffer) {
    parts.push({ type: "text", text: buffer });
  }
  return parts;
}

/** Chat must never wait on slow third-party APIs: give up on them after this, they keep loading. */
const THIRD_PARTY_WAIT_MS = 600;

/** Loads a channel's BTTV/FFZ/7TV emotes ahead of the first chat message. */
export function warmEmotes(broadcasterId: string) {
  void thirdPartyEmotes(broadcasterId).catch(() => null);
}

export async function twitchMessageParts(broadcasterId: string, fragments: Fragment[]): Promise<MessagePart[]> {
  const [lookup, cheers] = await Promise.all([
    Promise.race([thirdPartyEmotes(broadcasterId).catch(() => null), new Promise<null>((resolve) => setTimeout(() => resolve(null), THIRD_PARTY_WAIT_MS))]),
    fragments.some((fragment) => fragment.type === "cheermote") ? cheermotes(broadcasterId).catch(() => null) : Promise.resolve(null),
  ]);
  const parts: MessagePart[] = [];
  for (const fragment of fragments) {
    const text = fragment.text ?? "";
    if (fragment.type === "emote" && fragment.emote?.id) {
      const animated = Boolean(fragment.emote.format?.includes("animated"));
      parts.push({ type: "emote", name: text, url: twitchEmoteUrl(fragment.emote.id, animated), animated, source: "twitch" });
    } else if (fragment.type === "cheermote" && fragment.cheermote?.prefix) {
      const bits = fragment.cheermote.bits ?? 0;
      const tiers = cheers?.get(fragment.cheermote.prefix.toLowerCase());
      const tier = tiers?.filter((t) => t.min_bits <= bits).at(-1);
      parts.push(
        tier
          ? { type: "cheer", name: text, bits, url: tier.images.dark.animated["3"] ?? tier.images.dark.static["3"], color: tier.color }
          : { type: "text", text },
      );
    } else if (fragment.type === "mention") {
      parts.push({ type: "mention", text });
    } else {
      parts.push(...splitThirdParty(text, lookup));
    }
  }
  return mergeText(parts);
}

/** Joins adjacent text parts so renderers get the fewest elements. */
function mergeText(parts: MessagePart[]) {
  const merged: MessagePart[] = [];
  for (const part of parts) {
    const last = merged.at(-1);
    if (part.type === "text" && last?.type === "text") {
      last.text += part.text;
    } else {
      merged.push(part);
    }
  }
  return merged;
}
