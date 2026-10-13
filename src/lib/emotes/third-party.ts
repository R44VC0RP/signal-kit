/**
 * BetterTTV, FrankerFaceZ and 7TV emotes for a Twitch channel (plus each service's global set),
 * the third-party emotes viewers expect to render in chat overlays. Public APIs, no auth.
 * Cached per channel for an hour; failures degrade to "no third-party emotes".
 */

export type ThirdPartyEmote = { name: string; url: string; animated: boolean; zeroWidth: boolean; source: "bttv" | "ffz" | "7tv" };
type EmoteMap = Map<string, ThirdPartyEmote>;

const CHANNEL_TTL_MS = 60 * 60 * 1000;
const GLOBAL_TTL_MS = 6 * 60 * 60 * 1000;
const TIMEOUT_MS = 4000;

/** BTTV's built-in zero-width emotes (drawn on top of the previous emote). */
const BTTV_ZERO_WIDTH = new Set(["SoSnowy", "IceCold", "SantaHat", "TopHat", "ReinDeer", "CandyCane", "cvMask", "cvHazmat"]);

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { "User-Agent": "SignalKit/1.0 (+https://signal.ryan.ceo)" } });
    return response.ok ? ((await response.json()) as T) : null;
  } catch {
    return null;
  }
}

type BttvEmote = { id: string; code: string; imageType?: string; animated?: boolean };
type BttvFfzEmote = { id: number; code: string; images: Record<string, string | null>; animated?: boolean; imageType?: string };
type SevenTvEmote = { name: string; flags?: number; data?: { flags?: number; animated?: boolean; host?: { url: string; files?: { name: string; format?: string }[] } } };

function addBttv(map: EmoteMap, emotes: BttvEmote[] | undefined) {
  for (const emote of emotes ?? []) {
    map.set(emote.code, {
      name: emote.code,
      url: `https://cdn.betterttv.net/emote/${emote.id}/3x`,
      animated: emote.animated ?? emote.imageType === "gif",
      zeroWidth: BTTV_ZERO_WIDTH.has(emote.code),
      source: "bttv",
    });
  }
}

function addFfz(map: EmoteMap, emotes: BttvFfzEmote[] | undefined) {
  for (const emote of emotes ?? []) {
    const url = emote.images["4x"] ?? emote.images["2x"] ?? emote.images["1x"];
    if (url) {
      map.set(emote.code, { name: emote.code, url, animated: Boolean(emote.animated) || emote.imageType === "gif", zeroWidth: false, source: "ffz" });
    }
  }
}

function add7tv(map: EmoteMap, emotes: SevenTvEmote[] | undefined) {
  for (const emote of emotes ?? []) {
    const host = emote.data?.host;
    if (!host?.url) {
      continue;
    }
    const file = host.files?.find((f) => f.name === "4x.webp") ?? host.files?.find((f) => f.format === "WEBP") ?? host.files?.at(-1);
    // ZeroWidth: active-emote flag bit 0, or emote-data flag 1 << 8.
    const zeroWidth = Boolean((emote.flags ?? 0) & 1) || Boolean((emote.data?.flags ?? 0) & 256);
    map.set(emote.name, {
      name: emote.name,
      url: `https:${host.url}/${file?.name ?? "4x.webp"}`,
      animated: Boolean(emote.data?.animated),
      zeroWidth,
      source: "7tv",
    });
  }
}

let global: { at: number; map: EmoteMap } | null = null;
let globalInflight: Promise<EmoteMap> | null = null;
const channels = new Map<string, { at: number; map: EmoteMap }>();
const channelInflight = new Map<string, Promise<EmoteMap>>();

async function loadGlobal(): Promise<EmoteMap> {
  if (global && Date.now() - global.at < GLOBAL_TTL_MS) {
    return global.map;
  }
  globalInflight ??= (async () => {
    const [bttv, ffz, seventv] = await Promise.all([
      getJson<BttvEmote[]>("https://api.betterttv.net/3/cached/emotes/global"),
      getJson<BttvFfzEmote[]>("https://api.betterttv.net/3/cached/frankerfacez/emotes/global"),
      getJson<{ emotes?: SevenTvEmote[] }>("https://7tv.io/v3/emote-sets/global"),
    ]);
    const map: EmoteMap = new Map();
    addFfz(map, ffz ?? undefined);
    addBttv(map, bttv ?? undefined);
    add7tv(map, seventv?.emotes);
    global = { at: Date.now(), map };
    return map;
  })().finally(() => (globalInflight = null));
  return globalInflight;
}

async function loadChannel(twitchUserId: string): Promise<EmoteMap> {
  const cached = channels.get(twitchUserId);
  if (cached && Date.now() - cached.at < CHANNEL_TTL_MS) {
    return cached.map;
  }
  let job = channelInflight.get(twitchUserId);
  if (!job) {
    job = (async () => {
      const id = encodeURIComponent(twitchUserId);
      const [bttv, ffz, seventv] = await Promise.all([
        getJson<{ channelEmotes?: BttvEmote[]; sharedEmotes?: BttvEmote[] }>(`https://api.betterttv.net/3/cached/users/twitch/${id}`),
        getJson<BttvFfzEmote[]>(`https://api.betterttv.net/3/cached/frankerfacez/users/twitch/${id}`),
        getJson<{ emote_set?: { emotes?: SevenTvEmote[] } }>(`https://7tv.io/v3/users/twitch/${id}`),
      ]);
      const map: EmoteMap = new Map();
      addFfz(map, ffz ?? undefined);
      addBttv(map, [...(bttv?.sharedEmotes ?? []), ...(bttv?.channelEmotes ?? [])]);
      add7tv(map, seventv?.emote_set?.emotes);
      channels.set(twitchUserId, { at: Date.now(), map });
      return map;
    })().finally(() => channelInflight.delete(twitchUserId));
    channelInflight.set(twitchUserId, job);
  }
  return job;
}

/** Channel emotes override global ones with the same name (as in BTTV/7TV clients). */
export async function thirdPartyEmotes(twitchUserId: string) {
  const [globalMap, channelMap] = await Promise.all([loadGlobal(), loadChannel(twitchUserId)]);
  return (name: string) => channelMap.get(name) ?? globalMap.get(name) ?? null;
}
