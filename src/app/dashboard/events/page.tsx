import { EventLog } from "@/components/dashboard/EventLog";
import { loadConnections, requireDashboardUser } from "@/lib/dashboard";
import { recentEvents } from "@/lib/events/ingest";
import { toLogEvent } from "@/lib/events/log";

export default async function EventsPage() {
  const user = await requireDashboardUser();
  const [connections, history] = await Promise.all([loadConnections(user.id), recentEvents(user.id, { limit: 100 })]);
  const platforms = [...new Set(connections.map((connection) => connection.platform))];

  return (
    <>
      <EventLog platforms={platforms} initialEvents={history.events.map(toLogEvent)} initialHasMore={history.hasMore} />
    </>
  );
}
