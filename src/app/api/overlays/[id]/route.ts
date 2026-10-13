import { NextResponse } from "next/server";
import { getStats } from "@/lib/overlays/stats";
import { publicStats } from "@/lib/overlays/stats-core";
import { deleteOverlay, getOverlay, toView, updateOverlay } from "@/lib/overlays/store";
import { requireUser } from "@/lib/session";
import { relayHub } from "@/lib/ws/relay";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const user = await requireUser(request);
  if (user instanceof NextResponse) {
    return user;
  }
  const row = await getOverlay(user.id, (await params).id);
  if (!row) {
    return NextResponse.json({ error: "Overlay not found." }, { status: 404 });
  }
  // Stats let the customizer preview goals and labels with real numbers.
  const stats = publicStats(await getStats(user.id));
  return NextResponse.json({ overlay: { ...(await toView(row)), live: relayHub.overlayClients(row.id).length > 0 }, stats });
}

export async function PATCH(request: Request, { params }: Params) {
  const user = await requireUser(request);
  if (user instanceof NextResponse) {
    return user;
  }
  const row = await getOverlay(user.id, (await params).id);
  if (!row) {
    return NextResponse.json({ error: "Overlay not found." }, { status: 404 });
  }
  const body = (await request.json().catch(() => ({}))) as { name?: unknown; settings?: unknown };
  const updated = await updateOverlay(row, body);
  const view = await toView(updated);
  // Overlays already open in OBS pick up the change immediately, no refresh needed.
  relayHub.sendToOverlay(updated.id, { type: "signal_kit.overlay.settings", settings: view.settings, receivedAt: new Date().toISOString() });
  return NextResponse.json({ overlay: { ...view, live: relayHub.overlayClients(updated.id).length > 0 } });
}

export async function DELETE(request: Request, { params }: Params) {
  const user = await requireUser(request);
  if (user instanceof NextResponse) {
    return user;
  }
  const row = await getOverlay(user.id, (await params).id);
  if (!row) {
    return NextResponse.json({ error: "Overlay not found." }, { status: 404 });
  }
  await deleteOverlay(row);
  relayHub.disconnectOverlay(row.id, "Overlay deleted");
  return NextResponse.json({ ok: true });
}
