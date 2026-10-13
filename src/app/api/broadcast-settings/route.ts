import { NextResponse } from "next/server";
import { z } from "zod";
import type { connections } from "@/db/schema";
import { YOUTUBE_WRITE_SCOPE } from "@/lib/auth/scopes";
import { getBroadcasterConnection } from "@/lib/connections/manage";
import { ConnectionUnavailableError, getConnectionAccessToken } from "@/lib/connections/tokens";
import { requireUser } from "@/lib/session";
import {
  getChannelInformation,
  modifyChannelInformation,
  searchTwitchCategories,
} from "@/lib/twitch/api";
import { getVideo, listOwnedLiveBroadcasts, updateVideo } from "@/lib/youtube/api";

type Connection = typeof connections.$inferSelect;

const updateSchema = z.discriminatedUnion("provider", [
  z.object({
    provider: z.literal("twitch"),
    connectionId: z.string().optional(),
    title: z.string().trim().min(1).max(140).optional(),
    categoryName: z.string().trim().max(120).optional(),
    gameId: z.string().trim().max(32).optional(),
  }),
  z.object({
    provider: z.literal("youtube"),
    connectionId: z.string().optional(),
    broadcastId: z.string().trim().min(1),
    title: z.string().trim().min(1).max(100).optional(),
    description: z.string().max(5000).optional(),
    categoryId: z.string().trim().max(32).optional(),
    privacyStatus: z.enum(["public", "unlisted", "private"]).optional(),
  }),
]);

const TWITCH_WRITE_SCOPE = "channel:manage:broadcast";

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (user instanceof NextResponse) {
    return user;
  }

  const [twitchConnection, youtubeConnection] = await Promise.all([
    getBroadcasterConnection(user.id, "twitch"),
    getBroadcasterConnection(user.id, "youtube"),
  ]);
  const [twitch, youtube] = await Promise.all([
    reconnectOnUnavailable(twitchConnection, () => getTwitchSettings(twitchConnection)),
    reconnectOnUnavailable(youtubeConnection, () => getYouTubeSettings(youtubeConnection)),
  ]);
  return NextResponse.json({ twitch, youtube });
}

/** A connection whose grant is gone shows a reconnect prompt instead of failing the whole request. */
async function reconnectOnUnavailable<T>(connection: Connection | null, load: () => Promise<T>) {
  try {
    return await load();
  } catch (error) {
    if (connection && error instanceof ConnectionUnavailableError) {
      return { connected: true, canUpdate: false, needsReconnect: true, connectionId: connection.id };
    }
    throw error;
  }
}

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (user instanceof NextResponse) {
    return user;
  }

  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid broadcast settings.", issues: parsed.error.issues }, { status: 400 });
  }
  const body = parsed.data;
  try {
    return await applyUpdate(user.id, body);
  } catch (error) {
    if (error instanceof ConnectionUnavailableError) {
      return NextResponse.json({ error: `Reconnect ${body.provider === "twitch" ? "Twitch" : "YouTube"}: ${error.message}` }, { status: 409 });
    }
    throw error;
  }
}

async function applyUpdate(userId: string, body: z.infer<typeof updateSchema>) {

  if (body.provider === "twitch") {
    const connection = await getBroadcasterConnection(userId, "twitch", body.connectionId);
    if (!connection) {
      return NextResponse.json({ error: "Connect Twitch first." }, { status: 400 });
    }
    if (!connection.scopes.includes(TWITCH_WRITE_SCOPE)) {
      return NextResponse.json({ error: `Reconnect Twitch to grant ${TWITCH_WRITE_SCOPE}.` }, { status: 403 });
    }

    const { accessToken } = await getConnectionAccessToken(connection.id);
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

    await modifyChannelInformation(accessToken, connection.platformUserId, update);
    return NextResponse.json({ ok: true, twitch: await getTwitchSettings(connection) });
  }

  const connection = await getBroadcasterConnection(userId, "youtube", body.connectionId);
  if (!connection) {
    return NextResponse.json({ error: "Connect YouTube first." }, { status: 400 });
  }
  if (!connection.scopes.includes(YOUTUBE_WRITE_SCOPE)) {
    return NextResponse.json({ error: "Reconnect YouTube to grant broadcast update access." }, { status: 403 });
  }

  const { accessToken } = await getConnectionAccessToken(connection.id);
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
  return NextResponse.json({ ok: true, youtube: await getYouTubeSettings(connection) });
}

async function getTwitchSettings(connection: Connection | null) {
  if (!connection) {
    return { connected: false };
  }
  if (connection.status === "needs_reauth") {
    return { connected: true, canUpdate: false, needsReconnect: true, connectionId: connection.id };
  }
  const { accessToken } = await getConnectionAccessToken(connection.id);
  const channel = await getChannelInformation(accessToken, connection.platformUserId);
  const canUpdate = connection.scopes.includes(TWITCH_WRITE_SCOPE);
  return { connected: true, canUpdate, needsReconnect: !canUpdate, connectionId: connection.id, channel };
}

async function getYouTubeSettings(connection: Connection | null) {
  if (!connection) {
    return { connected: false };
  }
  if (connection.status === "needs_reauth") {
    return { connected: true, canUpdate: false, needsReconnect: true, connectionId: connection.id };
  }
  const { accessToken } = await getConnectionAccessToken(connection.id);
  const broadcasts = await listOwnedLiveBroadcasts(accessToken);
  const editableBroadcasts = broadcasts
    .filter((broadcast) => !["complete", "revoked"].includes(broadcast.status?.lifeCycleStatus ?? ""))
    .sort((left, right) => scoreBroadcast(right) - scoreBroadcast(left));
  const selected = editableBroadcasts[0];
  const video = selected ? await getVideo(accessToken, selected.id) : null;

  return {
    connected: true,
    canUpdate: connection.scopes.includes(YOUTUBE_WRITE_SCOPE),
    needsReconnect: !connection.scopes.includes(YOUTUBE_WRITE_SCOPE),
    connectionId: connection.id,
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

function scoreBroadcast(broadcast: { status?: { lifeCycleStatus?: string }; snippet?: { scheduledStartTime?: string } }) {
  const status = broadcast.status?.lifeCycleStatus;
  const statusScore = status === "live" ? 50 : status === "testing" ? 40 : status === "ready" ? 30 : 20;
  const scheduled = broadcast.snippet?.scheduledStartTime ? Date.parse(broadcast.snippet.scheduledStartTime) : 0;
  return statusScore * 1_000_000_000_000 + scheduled;
}
