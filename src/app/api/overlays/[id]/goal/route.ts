import { NextResponse } from "next/server";
import { sanitizeSettings } from "@/lib/overlays/settings";
import { startGoal } from "@/lib/overlays/stats";
import { publicStats } from "@/lib/overlays/stats-core";
import { getOverlay } from "@/lib/overlays/store";
import { requireUser } from "@/lib/session";

/** Restarts a goal overlay's count from now (its "Start from" value is added on top). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(request);
  if (user instanceof NextResponse) {
    return user;
  }
  const row = await getOverlay(user.id, (await params).id);
  if (!row || row.type !== "goal") {
    return NextResponse.json({ error: "Goal overlay not found." }, { status: 404 });
  }
  const settings = sanitizeSettings("goal", row.settings);
  const stats = await startGoal(user.id, row.id, settings.metric, settings.currency);
  return NextResponse.json({ ok: true, stats: publicStats(stats) });
}
