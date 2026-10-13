import { NextResponse } from "next/server";
import { sanitizeSettings } from "@/lib/overlays/settings";
import { applyTheme, findTheme } from "@/lib/overlays/themes";
import { listOverlays, toView, updateOverlay } from "@/lib/overlays/store";
import { requireUser } from "@/lib/session";
import { relayHub } from "@/lib/ws/relay";

/** Applies a theme pack to every overlay (or the given ones); open overlays restyle instantly. */
export async function POST(request: Request) {
  const user = await requireUser(request);
  if (user instanceof NextResponse) {
    return user;
  }
  const body = (await request.json().catch(() => ({}))) as { theme?: unknown; ids?: unknown };
  const theme = findTheme(body.theme);
  if (!theme) {
    return NextResponse.json({ error: "Unknown theme." }, { status: 400 });
  }
  const only = Array.isArray(body.ids) ? new Set(body.ids.filter((id): id is string => typeof id === "string")) : null;
  const rows = (await listOverlays(user.id)).filter((row) => !only || only.has(row.id));
  const overlays = [];
  for (const row of rows) {
    const settings = applyTheme(row.type, sanitizeSettings(row.type, row.settings), theme);
    const view = await toView(await updateOverlay(row, { settings }));
    relayHub.sendToOverlay(row.id, { type: "signal_kit.overlay.settings", settings: view.settings, receivedAt: new Date().toISOString() });
    overlays.push({ ...view, live: relayHub.overlayClients(row.id).length > 0 });
  }
  return NextResponse.json({ ok: true, theme: theme.id, overlays });
}
