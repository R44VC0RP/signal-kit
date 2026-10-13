import { NextResponse } from "next/server";
import { getOverlay, resetOverlayUrl, toView } from "@/lib/overlays/store";
import { requireUser } from "@/lib/session";
import { relayHub } from "@/lib/ws/relay";

/** Issues a new browser-source URL. The old URL stops working and its open overlays disconnect. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(request);
  if (user instanceof NextResponse) {
    return user;
  }
  const row = await getOverlay(user.id, (await params).id);
  if (!row) {
    return NextResponse.json({ error: "Overlay not found." }, { status: 404 });
  }
  const updated = await resetOverlayUrl(row);
  relayHub.disconnectOverlay(row.id, "Overlay URL was reset");
  return NextResponse.json({ overlay: { ...(await toView(updated)), live: false } });
}
