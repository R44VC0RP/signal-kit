import { LiveTools } from "@/components/dashboard/live/LiveTools";
import { PageHeader } from "@/components/dashboard/ui";
import { requireDashboardUser } from "@/lib/dashboard";

export default async function LivePage() {
  await requireDashboardUser();
  return (
    <>
      <PageHeader title="Live tools" description="Polls, giveaways, a viewer queue and pinned messages, with chat from every platform." />
      <LiveTools />
    </>
  );
}
