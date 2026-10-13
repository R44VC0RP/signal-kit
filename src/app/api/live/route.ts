import { NextResponse } from "next/server";
import { getEvent, recentChat } from "@/lib/events/ingest";
import { liveToolsHub } from "@/lib/live/tools";
import { requireUser } from "@/lib/session";

/** The Live tools page: current poll/giveaway/queue/highlight plus recent chat to pin from. */
export async function GET(request: Request) {
  const user = await requireUser(request);
  if (user instanceof NextResponse) {
    return user;
  }
  const [tools, chat] = await Promise.all([liveToolsHub.snapshot(user.id), recentChat(user.id, 60)]);
  return NextResponse.json({
    tools,
    chat: chat.map((event) => ({ id: event.id, platform: event.platform, name: event.actor?.name ?? "Someone", message: event.message, at: event.receivedAt })),
  });
}

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (user instanceof NextResponse) {
    return user;
  }
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action ?? "");
  const input = { ...body };
  if (action === "highlight.pin") {
    input.event = typeof body.eventId === "string" ? await getEvent(user.id, body.eventId) : null;
  }
  const result = await liveToolsHub.act(user.id, action, input);
  return NextResponse.json(result, { status: "error" in result ? 400 : 200 });
}
