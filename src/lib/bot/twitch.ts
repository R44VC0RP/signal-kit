import { getConnectionAccessToken } from "@/lib/connections/tokens";
import { getTwitchClientId } from "@/lib/twitch/api";
import { helixApp, HelixError } from "@/lib/twitch/helix-app";

/**
 * The Twitch calls the chat bot makes. Chat is sent with the app token (Twitch's recommended
 * way for bots: messages get the Chat Bot badge, using the sender's user:bot and the channel's
 * channel:bot); moderation, shoutouts, clips and markers use the broadcaster's own token.
 */

const HELIX = "https://api.twitch.tv/helix";

async function asUser<T>(connectionId: string, method: string, path: string, body?: unknown): Promise<T> {
  const { accessToken } = await getConnectionAccessToken(connectionId);
  const response = await fetch(`${HELIX}${path}`, {
    method,
    headers: { Authorization: `Bearer ${accessToken}`, "Client-Id": getTwitchClientId(), ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(8000),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new HelixError(response.status, text);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

/** Sends a chat message as the bot (app token), falling back to the sender's own token. */
export async function sendChat(broadcasterId: string, sender: { id: string; connectionId: string }, message: string, replyTo?: string) {
  const body = { broadcaster_id: broadcasterId, sender_id: sender.id, message: message.slice(0, 500), ...(replyTo ? { reply_parent_message_id: replyTo } : {}) };
  try {
    const result = await helixApp<{ data: { is_sent: boolean; drop_reason?: { message: string } }[] }>("POST", "/chat/messages", body);
    if (result.data[0] && !result.data[0].is_sent) {
      throw new Error(result.data[0].drop_reason?.message ?? "Twitch dropped the message.");
    }
  } catch (error) {
    if (error instanceof HelixError && (error.status === 401 || error.status === 403)) {
      await asUser(sender.connectionId, "POST", "/chat/messages", body);
      return;
    }
    throw error;
  }
}

export function deleteMessage(connectionId: string, broadcasterId: string, messageId: string) {
  return asUser(connectionId, "DELETE", `/moderation/chat?broadcaster_id=${broadcasterId}&moderator_id=${broadcasterId}&message_id=${encodeURIComponent(messageId)}`);
}

export function timeoutUser(connectionId: string, broadcasterId: string, userId: string, seconds: number, reason: string) {
  return asUser(connectionId, "POST", `/moderation/bans?broadcaster_id=${broadcasterId}&moderator_id=${broadcasterId}`, { data: { user_id: userId, duration: seconds, reason } });
}

export async function userByLogin(login: string) {
  const result = await helixApp<{ data: { id: string; login: string; display_name: string }[] }>("GET", `/users?login=${encodeURIComponent(login.replace(/^@/, "").toLowerCase())}`);
  return result.data[0] ?? null;
}

export async function lastGame(userId: string) {
  const result = await helixApp<{ data: { game_name: string; title: string }[] }>("GET", `/channels?broadcaster_id=${userId}`);
  return result.data[0] ?? null;
}

export function shoutout(connectionId: string, broadcasterId: string, toId: string) {
  return asUser(connectionId, "POST", `/chat/shoutouts?from_broadcaster_id=${broadcasterId}&to_broadcaster_id=${toId}&moderator_id=${broadcasterId}`);
}

/** Clips the last ~30 s; returns the clip's URL. */
export async function createClip(connectionId: string, broadcasterId: string) {
  const result = await asUser<{ data: { id: string; edit_url: string }[] }>(connectionId, "POST", `/clips?broadcaster_id=${broadcasterId}`);
  const clip = result.data[0];
  return clip ? `https://clips.twitch.tv/${clip.id}` : null;
}

export function createMarker(connectionId: string, broadcasterId: string, description: string) {
  return asUser(connectionId, "POST", "/streams/markers", { user_id: broadcasterId, description: description.slice(0, 140) });
}

export async function followedAt(connectionId: string, broadcasterId: string, userId: string) {
  const result = await asUser<{ data: { followed_at: string }[] }>(connectionId, "GET", `/channels/followers?broadcaster_id=${broadcasterId}&user_id=${encodeURIComponent(userId)}`);
  return result.data[0]?.followed_at ?? null;
}

/** Everyone in chat right now (for watch-time points). */
export async function chatters(connectionId: string, broadcasterId: string) {
  const all: { user_id: string; user_login: string; user_name: string }[] = [];
  let cursor = "";
  for (let page = 0; page < 20; page += 1) {
    const result = await asUser<{ data: { user_id: string; user_login: string; user_name: string }[]; pagination?: { cursor?: string } }>(
      connectionId,
      "GET",
      `/chat/chatters?broadcaster_id=${broadcasterId}&moderator_id=${broadcasterId}&first=1000${cursor ? `&after=${encodeURIComponent(cursor)}` : ""}`,
    );
    all.push(...result.data);
    cursor = result.pagination?.cursor ?? "";
    if (!cursor) {
      break;
    }
  }
  return all;
}
