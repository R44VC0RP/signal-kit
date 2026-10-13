import { NextResponse } from "next/server";
import { isOverlayType } from "@/lib/overlays/settings";
import { createOverlay, listOverlays, toView } from "@/lib/overlays/store";
import { requireUser } from "@/lib/session";
import { relayHub } from "@/lib/ws/relay";

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (user instanceof NextResponse) {
    return user;
  }
  const rows = await listOverlays(user.id);
  const overlays = await Promise.all(rows.map(async (row) => ({ ...(await toView(row)), live: relayHub.overlayClients(row.id).length > 0 })));
  return NextResponse.json({ overlays });
}

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (user instanceof NextResponse) {
    return user;
  }
  const body = (await request.json().catch(() => ({}))) as { type?: unknown; name?: unknown };
  if (!isOverlayType(body.type)) {
    return NextResponse.json({ error: "Choose an overlay type: alerts, chat, events, goal, label, emotewall or ticker." }, { status: 400 });
  }
  if ((await listOverlays(user.id)).length >= 50) {
    return NextResponse.json({ error: "You can have up to 50 overlays." }, { status: 400 });
  }
  const row = await createOverlay(user.id, body.type, typeof body.name === "string" ? body.name : undefined);
  return NextResponse.json({ overlay: { ...(await toView(row)), live: false } }, { status: 201 });
}
