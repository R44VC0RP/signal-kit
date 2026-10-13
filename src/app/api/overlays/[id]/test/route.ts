import { NextResponse } from "next/server";
import { getOverlay } from "@/lib/overlays/store";
import { SAMPLE_BUTTONS, sampleEvent, type SampleKind } from "@/lib/overlays/samples";
import { requireUser } from "@/lib/session";
import { relayHub } from "@/lib/ws/relay";

/**
 * Sends a sample event to the user's open overlays (OBS etc.), not to apps or the event log,
 * so streamers can check alerts, sound and layout without a real follow or tip.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(request);
  if (user instanceof NextResponse) {
    return user;
  }
  const row = await getOverlay(user.id, (await params).id);
  if (!row) {
    return NextResponse.json({ error: "Overlay not found." }, { status: 404 });
  }
  const body = (await request.json().catch(() => ({}))) as { kind?: unknown };
  const kind = SAMPLE_BUTTONS.find((button) => button.kind === body.kind)?.kind ?? (row.type === "chat" ? "chat.message" : "follow");
  const delivered = relayHub.publish(user.id, sampleEvent(kind as SampleKind), { overlaysOnly: true });
  return NextResponse.json({ ok: true, kind, delivered, live: relayHub.overlayClients(row.id).length > 0 });
}
