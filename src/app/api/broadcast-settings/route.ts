import { and, eq, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { connectedAccounts } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";
import {
  getChannelInformation,
  modifyChannelInformation,
  searchTwitchCategories,
} from "@/lib/twitch/api";
import { getUsableAccessToken } from "@/lib/twitch/tokens";
import { getVideo, listOwnedLiveBroadcasts, updateVideo } from "@/lib/youtube/api";
import { getUsableYouTubeAccessToken } from "@/lib/youtube/tokens";

const updateSchema = z.discriminatedUnion("provider", [
  z.object({
    provider: z.literal("twitch"),
    title: z.string().trim().min(1).max(140).optional(),
    categoryName: z.string().trim().max(120).optional(),
    gameId: z.string().trim().max(32).optional(),
  }),
  z.object({
    provider: z.literal("youtube"),
    broadcastId: z.string().trim().min(1),
    title: z.string().trim().min(1).max(100).optional(),
    description: z.string().max(5000).optional(),
    categoryId: z.string().trim().max(32).optional(),
    privacyStatus: z.enum(["public", "unlisted", "private"]).optional(),
  }),
]);

const YOUTUBE_WRITE_SCOPE = "https://www.googleapis.com/auth/youtube.force-ssl";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [twitch, youtube] = await Promise.all([getTwitchSettings(user), getYouTubeSettings(user)]);
  return NextResponse.json({ twitch, youtube });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = updateSchema.parse(await request.json());

  if (body.provider === "twitch") {
    if (!user.twitchUserId) {
      return NextResponse.json({ error: "Connect Twitch first." }, { status: 400 });
    }
    if (!user.twitchScopes.includes("channel:manage:broadcast")) {
      return NextResponse.json({ error: "Reconnect Twitch to grant channel:manage:broadcast." }, { status: 403 });
    }

    const accessToken = await getUsableAccessToken(user.twitchUserId);
    const update: { title?: string; game_id?: string } = {};
    if (body.title) {
      update.title = body.title;
    }
    if (body.gameId) {
      update.game_id = body.gameId;
    } else if (body.categoryName) {
      const categories = await searchTwitchCategories(accessToken, body.categoryName);
      const category =
        categories.find((item) => item.name.toLowerCase() === body.categoryName?.toLowerCase()) ?? categories[0];
      if (!category) {
        return NextResponse.json({ error: `No Twitch category found for "${body.categoryName}".` }, { status: 400 });
      }
      update.game_id = category.id;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "No Twitch changes provided." }, { status: 400 });
    }

    await modifyChannelInformation(accessToken, user.twitchUserId, update);
    return NextResponse.json({ ok: true, twitch: await getTwitchSettings(user) });
  }

  const account = await getYouTubeAccount(user.id);
  if (!account) {
    return NextResponse.json({ error: "Connect YouTube first." }, { status: 400 });
  }
  if (!account.scopes.includes(YOUTUBE_WRITE_SCOPE)) {
    return NextResponse.json({ error: "Reconnect YouTube to grant broadcast update access." }, { status: 403 });
  }

  const accessToken = await getUsableYouTubeAccessToken(account.id);
  const video = await getVideo(accessToken, body.broadcastId);
  if (!video) {
    return NextResponse.json({ error: "YouTube broadcast video not found." }, { status: 404 });
  }

  await updateVideo(accessToken, video, {
    title: body.title,
    description: body.description,
    categoryId: body.categoryId,
    privacyStatus: body.privacyStatus,
  });
  return NextResponse.json({ ok: true, youtube: await getYouTubeSettings(user) });
}

async function getTwitchSettings(user: { twitchUserId: string | null; twitchScopes: string[] }) {
  if (!user.twitchUserId) {
    return { connected: false };
  }
  const accessToken = await getUsableAccessToken(user.twitchUserId);
  const channel = await getChannelInformation(accessToken, user.twitchUserId);
  return {
    connected: true,
    canUpdate: user.twitchScopes.includes("channel:manage:broadcast"),
    needsReconnect: !user.twitchScopes.includes("channel:manage:broadcast"),
    channel,
  };
}

async function getYouTubeSettings(user: { id: string; twitchUserId: string | null }) {
  const account = await getYouTubeAccount(user.id, user.twitchUserId);
  if (!account) {
    return { connected: false };
  }
  const accessToken = await getUsableYouTubeAccessToken(account.id);
  const broadcasts = await listOwnedLiveBroadcasts(accessToken);
  const editableBroadcasts = broadcasts
    .filter((broadcast) => !["complete", "revoked"].includes(broadcast.status?.lifeCycleStatus ?? ""))
    .sort((left, right) => scoreBroadcast(right) - scoreBroadcast(left));
  const selected = editableBroadcasts[0];
  const video = selected ? await getVideo(accessToken, selected.id) : null;

  return {
    connected: true,
    canUpdate: account.scopes.includes(YOUTUBE_WRITE_SCOPE),
    needsReconnect: !account.scopes.includes(YOUTUBE_WRITE_SCOPE),
    broadcasts: editableBroadcasts.map((broadcast) => ({
      id: broadcast.id,
      title: broadcast.snippet?.title ?? broadcast.id,
      lifeCycleStatus: broadcast.status?.lifeCycleStatus ?? "unknown",
      scheduledStartTime: broadcast.snippet?.scheduledStartTime ?? null,
    })),
    video: video
      ? {
          id: video.id,
          title: video.snippet?.title ?? "",
          description: video.snippet?.description ?? "",
          categoryId: video.snippet?.categoryId ?? "",
          privacyStatus: video.status?.privacyStatus ?? "private",
        }
      : null,
  };
}

async function getYouTubeAccount(appUserId: string, twitchUserId?: string | null) {
  const [account] = await getDb()
    .select()
    .from(connectedAccounts)
    .where(
      and(
        eq(connectedAccounts.provider, "youtube"),
        twitchUserId
          ? or(eq(connectedAccounts.appUserId, appUserId), eq(connectedAccounts.ownerTwitchUserId, twitchUserId))
          : eq(connectedAccounts.appUserId, appUserId),
      ),
    )
    .limit(1);
  return account ?? null;
}

function scoreBroadcast(broadcast: { status?: { lifeCycleStatus?: string }; snippet?: { scheduledStartTime?: string } }) {
  const status = broadcast.status?.lifeCycleStatus;
  const statusScore = status === "live" ? 50 : status === "testing" ? 40 : status === "ready" ? 30 : 20;
  const scheduled = broadcast.snippet?.scheduledStartTime ? Date.parse(broadcast.snippet.scheduledStartTime) : 0;
  return statusScore * 1_000_000_000_000 + scheduled;
}
