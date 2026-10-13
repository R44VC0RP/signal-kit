import { OverlaysList } from "@/components/dashboard/overlays/OverlaysList";
import { PageHeader } from "@/components/dashboard/ui";
import { requireDashboardUser } from "@/lib/dashboard";
import { listOverlays, toView } from "@/lib/overlays/store";
import { relayHub } from "@/lib/ws/relay";

export default async function OverlaysPage() {
  const user = await requireDashboardUser();
  const rows = await listOverlays(user.id);
  const overlays = await Promise.all(rows.map(async (row) => ({ ...(await toView(row)), live: relayHub.overlayClients(row.id).length > 0 })));
  return (
    <>
      <PageHeader title="Overlays" description="What your viewers see. Each overlay is one browser source in OBS, with Twitch, YouTube and X together." />
      <OverlaysList initial={overlays} />
    </>
  );
}
