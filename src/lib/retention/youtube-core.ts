import type { StreamSummary } from "@/lib/streams/summary";

/**
 * YouTube API Services policy (III.E.4): data obtained from YouTube, and statistics derived from
 * it, must not be stored or displayed for more than 30 days without refreshing it. Signal Kit
 * can't refresh past chat, viewer counts or Super Chats, so it deletes them once they are 30
 * days old. Pure (no server imports): the purge job, read-time guards and overlays share it.
 * The purge itself is in ./youtube.ts.
 */

export const YOUTUBE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/** Anything from YouTube older than this moment must be gone. */
export function youtubeCutoff(now = Date.now()) {
  return now - YOUTUBE_RETENTION_MS;
}

/** Whether a timestamp is older than the retention window (unknown or invalid times count as old). */
export function isExpired(at: string | number | Date | null | undefined, now = Date.now()) {
  const time = at instanceof Date ? at.getTime() : typeof at === "string" ? Date.parse(at) : typeof at === "number" ? at : NaN;
  return !(time >= youtubeCutoff(now));
}

/**
 * Removes everything YouTube from a stream summary: the YouTube platform stats (viewer samples,
 * chat counts, broadcast id and title, subs, Super Chats), YouTube timeline values, YouTube
 * supporters and highlights. A title that only YouTube reported is replaced by another
 * platform's title, or null. Returns a new summary; `changed` says whether anything was removed.
 */
export function stripYouTubeFromSummary(summary: StreamSummary, title: string | null) {
  let changed = false;
  const { youtube, ...platforms } = summary.platforms ?? {};
  if (youtube) {
    changed = true;
  }
  const timeline = (summary.timeline ?? []).map((point) => {
    if (point.v?.youtube === undefined && point.m?.youtube === undefined) {
      return point;
    }
    changed = true;
    const v = { ...point.v };
    const m = { ...point.m };
    delete v.youtube;
    delete m.youtube;
    return { v, m };
  });
  const supporters = Object.fromEntries(Object.entries(summary.supporters ?? {}).filter(([key, supporter]) => supporter.platform !== "youtube" && !key.startsWith("youtube:")));
  if (Object.keys(supporters).length !== Object.keys(summary.supporters ?? {}).length) {
    changed = true;
  }
  const highlights = (summary.highlights ?? []).filter((highlight) => highlight.platform !== "youtube");
  if (highlights.length !== (summary.highlights ?? []).length) {
    changed = true;
  }
  // With YouTube in the stream, keep the title only if a remaining platform reported it;
  // otherwise it may be the YouTube broadcast title.
  const otherTitles = Object.values(platforms)
    .map((stats) => stats?.title)
    .filter((value): value is string => Boolean(value));
  const nextTitle = !youtube || (title && otherTitles.includes(title)) ? title : (otherTitles[0] ?? null);
  if (nextTitle !== title) {
    changed = true;
  }
  return {
    summary: { ...summary, platforms, timeline, supporters, highlights },
    title: nextTitle,
    changed,
    /** No platform left: the stream only existed on YouTube. */
    empty: Boolean(youtube) && Object.keys(platforms).length === 0,
  };
}
