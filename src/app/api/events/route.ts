import { NextResponse } from "next/server";
import { isEventId } from "@/lib/events/ids";
import { recentEvents } from "@/lib/events/ingest";
import { toLogEvent } from "@/lib/events/log";
import { requireUser } from "@/lib/session";

/** Older events for the dashboard's event log: GET /api/events?before=<event id>&limit=100 */
export async function GET(request: Request) {
  const user = await requireUser(request);
  if (user instanceof NextResponse) {
    return user;
  }
  const url = new URL(request.url);
  const before = url.searchParams.get("before");
  if (before && !isEventId(before)) {
    return NextResponse.json({ error: "Invalid before id." }, { status: 400 });
  }
  const limit = Number(url.searchParams.get("limit") ?? 100) || 100;
  const page = await recentEvents(user.id, { before, limit });
  return NextResponse.json({ events: page.events.map(toLogEvent), hasMore: page.hasMore });
}
