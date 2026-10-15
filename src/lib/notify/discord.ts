import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { connections } from "@/db/schema";
import { getAppUrl } from "@/lib/app-url";
import { durationMs } from "@/lib/streams/store";
import { topEmotes, totals, type StreamSummary } from "@/lib/streams/summary";
import { discordWebhookFor } from "./settings";

/**
 * Discord posts for a streamer's server: "live now" with links to every platform, and a recap
 * when the stream ends. Sent through the streamer's own webhook; failures are logged, never
 * retried in a loop.
 */

const COLOR = 0x3d6bff;

async function post(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "Signal Kit", allowed_mentions: { parse: [] }, ...(body as object) }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) {
    throw new Error(`Discord answered ${response.status}`);
  }
}

/** Where viewers can watch: the channel page per live platform. */
async function watchLinks(userId: string, summary: StreamSummary) {
  const rows = await getDb()
    .select()
    .from(connections)
    .where(and(eq(connections.userId, userId), eq(connections.status, "active")));
  const links: string[] = [];
  for (const [platform, stats] of Object.entries(summary.platforms)) {
    if (!stats?.live && !stats?.endedAt) {
      continue;
    }
    const connection = rows.find((row) => row.id === stats.connectionId) ?? rows.find((row) => row.platform === platform);
    if (platform === "twitch" && connection) {
      links.push(`[Twitch](https://twitch.tv/${encodeURIComponent(connection.displayName.toLowerCase())})`);
    } else if (platform === "youtube" && stats.broadcastId) {
      links.push(`[YouTube](https://youtube.com/watch?v=${encodeURIComponent(stats.broadcastId)})`);
    } else if (platform === "x" && stats.broadcastId) {
      links.push(`[X](https://x.com/i/broadcasts/${encodeURIComponent(stats.broadcastId)})`);
    } else if (platform === "x" && connection) {
      links.push(`[X](https://x.com/${encodeURIComponent(connection.displayName.replace(/^@/, ""))})`);
    }
  }
  return links;
}

export async function notifyLive(userId: string, stream: { title: string | null; summary: StreamSummary }) {
  const webhook = await discordWebhookFor(userId).catch(() => null);
  if (!webhook?.live) {
    return;
  }
  const links = await watchLinks(userId, stream.summary);
  const category = Object.values(stream.summary.platforms).find((p) => p?.category)?.category;
  await post(webhook.url, {
    embeds: [
      {
        color: COLOR,
        title: `🔴 Live now${stream.title ? `: ${stream.title}` : ""}`,
        description: [category ? `Playing **${category}**` : null, links.length ? `Watch on ${links.join(" · ")}` : null].filter(Boolean).join("\n") || undefined,
        timestamp: new Date().toISOString(),
      },
    ],
  }).catch((error) => console.warn(`[discord] live post failed: ${(error as Error).message}`));
}

export async function notifyRecap(userId: string, stream: { id: string; title: string | null; startedAt: string; endedAt: string; summary: StreamSummary }) {
  const webhook = await discordWebhookFor(userId).catch(() => null);
  if (!webhook?.recap) {
    return;
  }
  const t = totals(stream.summary);
  const duration = durationMs(stream, Date.parse(stream.endedAt));
  const hours = Math.floor(duration / 3_600_000);
  const minutes = Math.round((duration % 3_600_000) / 60_000);
  const tips = Object.entries(t.tips)
    .map(([currency, value]) => new Intl.NumberFormat("en", { style: "currency", currency }).format(value))
    .join(" · ");
  const fields = [
    { name: "Peak viewers", value: t.peakViewers.toLocaleString("en"), inline: true },
    { name: "Average viewers", value: t.avgViewers.toLocaleString("en"), inline: true },
    { name: "Chatters", value: `${t.chatters.toLocaleString("en")}${t.newChatters ? ` (${t.newChatters} new)` : ""}`, inline: true },
    { name: "Messages", value: t.messages.toLocaleString("en"), inline: true },
    { name: "New followers", value: t.follows.toLocaleString("en"), inline: true },
    { name: "Subs", value: `${t.subs.toLocaleString("en")}${t.giftedSubs ? ` (${t.giftedSubs} gifted)` : ""}`, inline: true },
    ...(t.bits ? [{ name: "Bits", value: t.bits.toLocaleString("en"), inline: true }] : []),
    ...(tips ? [{ name: "Tips", value: tips, inline: true }] : []),
    ...(t.raids ? [{ name: "Raids", value: String(t.raids), inline: true }] : []),
  ];
  const emotes = topEmotes(stream.summary, 3).map((emote) => `${emote.name} ×${emote.count}`);
  await post(webhook.url, {
    embeds: [
      {
        color: COLOR,
        title: `Stream recap${stream.title ? `: ${stream.title}` : ""}`,
        url: `${getAppUrl()}/dashboard/streams/${stream.id}`,
        description: `Live for ${hours ? `${hours}h ` : ""}${minutes}m${emotes.length ? `\nTop emotes: ${emotes.join(", ")}` : ""}`,
        fields,
        ...(stream.summary.platforms.youtube ? { footer: { text: "Stats calculated by Signal Kit from stream events, not provided by YouTube." } } : {}),
        timestamp: stream.endedAt,
      },
    ],
  }).catch((error) => console.warn(`[discord] recap post failed: ${(error as Error).message}`));
}

/** The "Send test" button in settings. */
export async function sendDiscordTest(url: string) {
  await post(url, { embeds: [{ color: COLOR, title: "Signal Kit is connected", description: "You'll get a post here when you go live and a recap when you end." }] });
}
