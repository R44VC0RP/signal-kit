import { BotEditor } from "@/components/dashboard/bot/BotEditor";
import { PageHeader } from "@/components/dashboard/ui";
import { botContext } from "@/lib/bot/context";
import { chatBot } from "@/lib/bot/engine";
import { requireDashboardUser } from "@/lib/dashboard";

export default async function BotPage() {
  const user = await requireDashboardUser();
  const [config, context] = await Promise.all([chatBot.config(user.id), botContext(user.id)]);
  return (
    <>
      <PageHeader title="Chat bot" description="Commands, timed messages, spam filters, loyalty points and stream markers for Twitch chat." />
      <BotEditor initial={config} context={context} />
    </>
  );
}
