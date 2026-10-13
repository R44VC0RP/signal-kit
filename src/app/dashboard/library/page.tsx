import { Library } from "@/components/dashboard/library/Library";
import { PageHeader } from "@/components/dashboard/ui";
import { requireDashboardUser } from "@/lib/dashboard";
import { listOverlays, toView } from "@/lib/overlays/store";

export default async function LibraryPage() {
  const user = await requireDashboardUser();
  const overlays = await Promise.all((await listOverlays(user.id)).map(toView));
  return (
    <>
      <PageHeader title="Library" description="Themes, alert art and sounds you can use on stream for free, and a one-click setup for OBS." />
      <Library overlayTypes={[...new Set(overlays.map((overlay) => overlay.type))]} />
    </>
  );
}
