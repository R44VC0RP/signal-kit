import { NextResponse } from "next/server";
import { ALERT_KINDS, isOverlayType, sanitizeSettings, type AlertSettings, type OverlayType } from "@/lib/overlays/settings";
import { ALERT_PACKS } from "@/lib/library";
import { applyTheme, findTheme } from "@/lib/overlays/themes";
import { createOverlay, listOverlays, toView, updateOverlay } from "@/lib/overlays/store";
import { requireUser } from "@/lib/session";
import { relayHub } from "@/lib/ws/relay";

/**
 * The library's one-click setup: creates any missing overlays of the chosen types, then styles
 * every overlay with a theme and gives alert overlays an art + sound pack. Returns all overlays
 * so the dashboard can add them to OBS in the same click.
 */
export async function POST(request: Request) {
  const user = await requireUser(request);
  if (user instanceof NextResponse) {
    return user;
  }
  const body = (await request.json().catch(() => ({}))) as { theme?: unknown; pack?: unknown; types?: unknown };
  const theme = body.theme ? findTheme(body.theme) : null;
  const pack = ALERT_PACKS.find((item) => item.id === body.pack) ?? null;
  const types = (Array.isArray(body.types) ? body.types : []).filter(isOverlayType) as OverlayType[];

  let rows = await listOverlays(user.id);
  for (const type of new Set(types)) {
    if (!rows.some((row) => row.type === type) && rows.length < 50) {
      await createOverlay(user.id, type);
    }
  }
  rows = await listOverlays(user.id);

  const overlays = [];
  for (const row of rows) {
    let settings = sanitizeSettings(row.type, row.settings);
    if (theme) {
      settings = applyTheme(row.type, settings, theme);
    }
    if (pack && row.type === "alerts") {
      const alerts = settings as AlertSettings;
      settings = { ...alerts, templates: Object.fromEntries(ALERT_KINDS.map((kind) => [kind, { ...alerts.templates[kind], ...pack.media[kind], showImage: true }])) as AlertSettings["templates"] };
    }
    const view = await toView(await updateOverlay(row, { settings }));
    relayHub.sendToOverlay(row.id, { type: "signal_kit.overlay.settings", settings: view.settings, receivedAt: new Date().toISOString() });
    overlays.push({ ...view, live: relayHub.overlayClients(row.id).length > 0 });
  }
  return NextResponse.json({ ok: true, overlays });
}
