import { NextResponse } from "next/server";
import { EVENT_CATALOG, eventCatalogForUser } from "@/lib/twitch/event-catalog";
import { getCurrentUser } from "@/lib/session";

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
  if (!user) {
    return NextResponse.json({ events: EVENT_CATALOG, youtubeLiveEvents: YOUTUBE_LIVE_EVENTS });
  }
  return NextResponse.json({
    events: eventCatalogForUser({ id: user.id, scopes: user.scopes }),
    youtubeLiveEvents: YOUTUBE_LIVE_EVENTS,
  });
}
