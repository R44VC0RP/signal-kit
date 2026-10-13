import { SettingsForm } from "@/components/dashboard/SettingsForm";
import { PageHeader } from "@/components/dashboard/ui";
import { getAppUrl } from "@/lib/app-url";
import { requireDashboardUser } from "@/lib/dashboard";
import { getPreferences } from "@/lib/notify/settings";

export default async function SettingsPage() {
  const user = await requireDashboardUser();
  return (
    <>
      <PageHeader title="Settings" description="Discord notifications and your public stats page." />
      <SettingsForm initial={await getPreferences(user.id)} appUrl={getAppUrl()} />
    </>
  );
}
