import { NextResponse } from "next/server";
import { getBroadcasterConnection } from "@/lib/connections/manage";
import { getCurrentUser } from "@/lib/session";
import { EVENT_CATALOG, eventCatalogForUser } from "@/lib/twitch/event-catalog";

const YOUTUBE_LIVE_EVENTS = [
  "youtube.live_chat.message",
  "youtube.live_chat.super_chat",
  "youtube.live_chat.super_sticker",
  "youtube.live_chat.new_sponsor",
  "youtube.live_chat.member_milestone",
  "youtube.live_chat.membership_gifting",
  "youtube.live_chat.gift_membership_received",
  "youtube.live_chat.user_banned",
  "youtube.live_chat.message_deleted",
  "youtube.live_chat.ended",
];

export async function GET() {
  const user = await getCurrentUser();
  const twitch = user ? await getBroadcasterConnection(user.id, "twitch") : null;
  const events = twitch
    ? eventCatalogForUser({ id: twitch.platformUserId, scopes: twitch.scopes })
    : EVENT_CATALOG;
  return NextResponse.json({
    // buildCondition is a function; JSON drops it, so this returns the serializable catalog.
    events,
    youtubeLiveEvents: YOUTUBE_LIVE_EVENTS,
  });
}
