import { NextResponse } from "next/server";
import { getBroadcasterConnection } from "@/lib/connections/manage";
import { requireUser } from "@/lib/session";
import { eventSubManager } from "@/lib/twitch/eventsub-manager";
import { syncDesiredSubscriptionsForConnection } from "@/lib/twitch/subscriptions";

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (user instanceof NextResponse) {
    return user;
  }
  const connection = await getBroadcasterConnection(user.id, "twitch");
  if (!connection) {
    return NextResponse.json({ error: "Connect Twitch before syncing EventSub subscriptions." }, { status: 400 });
  }

  const result = await syncDesiredSubscriptionsForConnection(connection.id, { resetRevoked: true });
  eventSubManager.reconcileSoon();
  return NextResponse.json(result);
}
