import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OverlayEditor } from "@/components/dashboard/overlays/OverlayEditor";
import { requireDashboardUser } from "@/lib/dashboard";
import { getOverlay, toView } from "@/lib/overlays/store";
import { relayHub } from "@/lib/ws/relay";

export const metadata: Metadata = { title: "Customize overlay · Signal Kit" };

/** The overlay customizer: full screen, no dashboard sidebar, so the preview gets the room. */
export default async function StudioPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ setup?: string }> }) {
  const user = await requireDashboardUser();
  const row = await getOverlay(user.id, (await params).id);
  if (!row) {
    notFound();
  }
  const overlay = { ...(await toView(row)), live: relayHub.overlayClients(row.id).length > 0 };
  return (
    <div className="sk-app flex h-dvh flex-col overflow-hidden">
      <OverlayEditor key={overlay.id} initial={overlay} openSetup={(await searchParams).setup === "1"} />
    </div>
  );
}
