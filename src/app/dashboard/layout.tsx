import type { ReactNode } from "react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { loadApiKeys, loadConnections, requireDashboardUser } from "@/lib/dashboard";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await requireDashboardUser();
  const [connections, keys] = await Promise.all([loadConnections(user.id), loadApiKeys()]);

  return (
    <div className="sk-app flex min-h-dvh">
      <Sidebar user={user} counts={{ connections: connections.length, keys: keys.length }} />
      <main className="flex min-w-0 flex-1 justify-center px-12 py-10">
        <div className="flex w-full max-w-240 flex-col gap-10">{children}</div>
      </main>
    </div>
  );
}
