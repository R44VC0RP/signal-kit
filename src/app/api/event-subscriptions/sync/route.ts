import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { eventSubManager } from "@/lib/twitch/eventsub-manager";
import { syncDesiredSubscriptionsForUser } from "@/lib/twitch/subscriptions";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!user.twitchUserId) {
    return NextResponse.json({ error: "Connect Twitch before syncing EventSub subscriptions." }, { status: 400 });
  }

  const result = await syncDesiredSubscriptionsForUser(user.twitchUserId);
  await eventSubManager.ensureUser(user.twitchUserId, user.id);
  return NextResponse.json(result);
}
