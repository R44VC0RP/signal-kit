import { helixApp } from "./helix-app";

/**
 * Twitch chat badge images (moderator sword, VIP diamond, broadcaster, the channel's own
 * subscriber and bits badges…), resolved from the badge set_id/id pairs in EventSub chat
 * events via Helix. Channel badges override global ones. Cached for an hour.
 */

export type BadgeImage = { set: string; id: string; title: string; url: string };

type BadgeSets = { data: { set_id: string; versions: { id: string; title: string; image_url_4x: string }[] }[] };
type Cache = { at: number; map: Map<string, BadgeImage> };

const TTL_MS = 60 * 60 * 1000;
let global: Cache | null = null;
let globalInflight: Promise<Cache> | null = null;
const channels = new Map<string, Cache>();
const channelInflight = new Map<string, Promise<Cache>>();

function toMap(sets: BadgeSets) {
  const map = new Map<string, BadgeImage>();
  for (const set of sets.data ?? []) {
    for (const version of set.versions ?? []) {
      map.set(`${set.set_id}/${version.id}`, { set: set.set_id, id: version.id, title: version.title, url: version.image_url_4x });
    }
  }
  return map;
}

async function globalBadges() {
  if (global && Date.now() - global.at < TTL_MS) {
    return global;
  }
  globalInflight ??= helixApp<BadgeSets>("GET", "/chat/badges/global")
    .then((sets) => (global = { at: Date.now(), map: toMap(sets) }))
    .finally(() => (globalInflight = null));
  return globalInflight;
}

async function channelBadges(broadcasterId: string) {
  const cached = channels.get(broadcasterId);
  if (cached && Date.now() - cached.at < TTL_MS) {
    return cached;
  }
  let job = channelInflight.get(broadcasterId);
  if (!job) {
    job = helixApp<BadgeSets>("GET", `/chat/badges?broadcaster_id=${encodeURIComponent(broadcasterId)}`)
      .then((sets) => {
        const entry = { at: Date.now(), map: toMap(sets) };
        channels.set(broadcasterId, entry);
        return entry;
      })
      .finally(() => channelInflight.delete(broadcasterId));
    channelInflight.set(broadcasterId, job);
  }
  return job;
}

/** Images for a chatter's badges, in the order Twitch sent them. Unknown badges are skipped. */
export async function resolveTwitchBadges(broadcasterId: string, badges: { set_id?: string; id?: string }[]): Promise<BadgeImage[]> {
  if (badges.length === 0) {
    return [];
  }
  const [globalSet, channelSet] = await Promise.all([globalBadges(), channelBadges(broadcasterId).catch(() => null)]);
  return badges
    .map((badge) => {
      const key = `${badge.set_id}/${badge.id}`;
      return channelSet?.map.get(key) ?? globalSet.map.get(key) ?? null;
    })
    .filter((image): image is BadgeImage => image !== null);
}
