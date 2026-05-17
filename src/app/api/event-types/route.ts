import { NextResponse } from "next/server";
import { EVENT_CATALOG, eventCatalogForUser } from "@/lib/twitch/event-catalog";
import { getCurrentUser } from "@/lib/session";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ events: EVENT_CATALOG });
  }
  return NextResponse.json({ events: eventCatalogForUser({ id: user.id, scopes: user.scopes }) });
}
