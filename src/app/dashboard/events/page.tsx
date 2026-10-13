import { EventLog } from "@/components/dashboard/EventLog";
import { loadConnections, requireDashboardUser } from "@/lib/dashboard";

export default async function EventsPage() {
  const user = await requireDashboardUser();
  const connections = await loadConnections(user.id);
  const platforms = [...new Set(connections.map((connection) => connection.platform))];

  return (
    <>
      <EventLog platforms={platforms} />
    </>
  );
}
