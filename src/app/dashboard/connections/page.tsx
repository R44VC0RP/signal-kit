import { ConnectButton, type ProviderId } from "@/components/AuthButtons";
import { DisconnectButton, RoleToggle } from "@/components/dashboard/actions";
import { ConnectionStatus } from "@/components/dashboard/ConnectionStatus";
import { channelUrl, PLATFORM_NAME, PlatformTile } from "@/components/dashboard/PlatformLogo";
import { buttonClass, Muted, PageHeader, Row, Section } from "@/components/dashboard/ui";
import type { Platform } from "@/db/schema";
import { enabledProviders, loadConnections, requireDashboardUser } from "@/lib/dashboard";
import { shortDate } from "@/lib/format";

const PROVIDER: Record<Platform, ProviderId> = { twitch: "twitch", youtube: "google", x: "twitter" };

const OPTIONS: { platform: Platform; role?: "bot"; title: string; description: string }[] = [
  { platform: "twitch", title: "Twitch channel", description: "Follows, subs, cheers, raids, chat and stream info" },
  { platform: "twitch", role: "bot", title: "Twitch bot account", description: "A separate account that reads and sends chat under its own name" },
  { platform: "youtube", title: "YouTube channel", description: "Live chat, Super Chats, memberships and broadcast details" },
  { platform: "x", title: "X account", description: "Live chat, follows, subscriptions and stream start/end" },
];

const ERRORS: Record<string, string> = {
  account_already_linked_to_different_user: "That account is already connected to a different Signal Kit user.",
  access_denied: "Connecting was cancelled.",
};

export default async function ConnectionsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await requireDashboardUser();
  const connections = await loadConnections(user.id);
  const providers = enabledProviders();
  const { error } = await searchParams;

  return (
    <>
      <PageHeader title="Connections" description="The accounts Signal Kit listens to. Every connection shares your API keys." />

      {error ? (
        <p role="alert" className="rounded-(--r) border border-[rgb(255_143_63/35%)] bg-[rgb(255_143_63/12%)] px-4 py-3 text-[13px] text-(--text)">
          {ERRORS[error] ?? `Connecting failed (${error}).`}
        </p>
      ) : null}

      <Section title="Connected" aside={<Muted>{`${connections.length} ${connections.length === 1 ? "account" : "accounts"}`}</Muted>}>
        {connections.length === 0 ? (
          <Row>
            <Muted>Nothing connected yet. Add an account below.</Muted>
          </Row>
        ) : null}
        {connections.map((connection) => (
          <Row key={connection.id} className="py-3">
            <PlatformTile
              platform={connection.platform}
              href={channelUrl(connection.platform, connection.platformUserId)}
              label={connection.platform === "youtube" ? `Open ${connection.displayName} on YouTube` : undefined}
            />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-[13px] font-medium text-(--text)">{connection.displayName}</span>
              <Muted>
                {PLATFORM_NAME[connection.platform]} · @{connection.username.replace(/^@/, "")} · {connection.scopes.length} {connection.scopes.length === 1 ? "permission" : "permissions"} · connected{" "}
                {shortDate(connection.createdAt)}
              </Muted>
              {connection.statusReason && connection.status !== "active" ? (
                <span className="truncate text-xs text-(--text-3)" title={connection.statusReason}>
                  {connection.statusReason}
                </span>
              ) : null}
            </div>
            <div className="w-38 shrink-0">
              {connection.platform === "twitch" ? (
                <RoleToggle id={connection.id} role={connection.role} />
              ) : (
                <Muted>Channel</Muted>
              )}
            </div>
            <div className="w-40 shrink-0">
              <ConnectionStatus connection={connection} />
            </div>
            <div className="flex w-52 shrink-0 items-center justify-end gap-1.5">
              <DisconnectButton id={connection.id} name={connection.displayName} platform={connection.platform} />
              {connection.status !== "active" ? (
                <ConnectButton provider={PROVIDER[connection.platform]} mode="link" role={connection.role} className={buttonClass("primary")}>
                  Reconnect
                </ConnectButton>
              ) : null}
            </div>
          </Row>
        ))}
      </Section>

      <Section title="Add a connection">
        {OPTIONS.map((option) => {
          const available = providers[PROVIDER[option.platform]];
          return (
            <Row key={option.title}>
              <PlatformTile
                platform={option.platform}
                href={option.platform === "youtube" ? "https://www.youtube.com" : undefined}
                label={option.platform === "youtube" ? "YouTube" : undefined}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[13px] font-medium text-(--text)">{option.title}</span>
                <Muted>{option.description}</Muted>
              </div>
              {available ? (
                <ConnectButton provider={PROVIDER[option.platform]} mode="link" role={option.role} className={buttonClass("control")}>
                  Connect
                </ConnectButton>
              ) : (
                <Muted>Coming soon</Muted>
              )}
            </Row>
          );
        })}
      </Section>
    </>
  );
}
