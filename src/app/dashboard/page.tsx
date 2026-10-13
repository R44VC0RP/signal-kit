import Link from "next/link";
import { ConnectButton, type ProviderId } from "@/components/AuthButtons";
import { CopyButton, RevokeKeyButton } from "@/components/dashboard/actions";
import { ConnectionStatus } from "@/components/dashboard/ConnectionStatus";
import { PLATFORM_NAME, PlatformTile } from "@/components/dashboard/PlatformLogo";
import { buttonClass, Muted, PageHeader, Row, Section, Status } from "@/components/dashboard/ui";
import type { Platform } from "@/db/schema";
import { enabledProviders, loadApiKeys, loadConnections, requireDashboardUser } from "@/lib/dashboard";
import { timeAgo } from "@/lib/format";

const PROVIDER: Record<Platform, ProviderId> = { twitch: "twitch", youtube: "google", x: "twitter" };
const PLATFORM_BLURB: Record<Platform, string> = {
  twitch: "Follows, subs, cheers, raids and chat",
  youtube: "Live chat, Super Chats and memberships",
  x: "Live chat, follows and broadcasts",
};

export default async function OverviewPage() {
  const user = await requireDashboardUser();
  const [connections, keys] = await Promise.all([loadConnections(user.id), loadApiKeys()]);
  const providers = enabledProviders();
  const missing = (["twitch", "youtube", "x"] as const).filter((platform) => !connections.some((c) => c.platform === platform));
  const listened = keys.some((key) => key.lastUsedAt);
  const steps = [
    { title: "Connect an account", done: connections.length > 0 },
    { title: "Create an API key", done: keys.length > 0 },
    { title: "Listen for events", done: listened },
  ];
  const doneCount = steps.filter((step) => step.done).length;

  return (
    <>
      <PageHeader title="Overview" description="Your connected accounts and the keys your apps use to listen." />

      <Section
        title="Connections"
        aside={
          <Link href="/dashboard/connections" className={buttonClass("control")}>
            Connect account
          </Link>
        }
      >
        {connections.map((connection) => (
          <Row key={connection.id}>
            <PlatformTile platform={connection.platform} />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-[13px] font-medium text-(--text)">{connection.displayName}</span>
              <Muted>
                {PLATFORM_NAME[connection.platform]} · {connection.role === "bot" ? "chat bot" : "channel"}
              </Muted>
            </div>
            <div className="w-40 shrink-0"><ConnectionStatus connection={connection} /></div>
            <div className="flex w-28 shrink-0 justify-end">
              {connection.status === "active" ? (
                <Link href="/dashboard/connections" className={buttonClass("control")}>
                  Manage
                </Link>
              ) : (
                <ConnectButton provider={PROVIDER[connection.platform]} mode="link" role={connection.role} className={buttonClass("primary")}>
                  Reconnect
                </ConnectButton>
              )}
            </div>
          </Row>
        ))}
        {missing.map((platform) => (
          <Row key={platform}>
            <PlatformTile platform={platform} />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[13px] font-medium text-(--text)">{PLATFORM_NAME[platform]}</span>
              <Muted>{PLATFORM_BLURB[platform]}</Muted>
            </div>
            <div className="w-40 shrink-0">
              <Status tone="off">{providers[PROVIDER[platform]] ? "Not connected" : "Coming soon"}</Status>
            </div>
            <div className="flex w-28 shrink-0 justify-end">
              {providers[PROVIDER[platform]] ? (
                <ConnectButton provider={PROVIDER[platform]} mode="link" className={buttonClass("control")}>
                  Connect
                </ConnectButton>
              ) : null}
            </div>
          </Row>
        ))}
      </Section>

      <div className="flex gap-12">
        <div className="min-w-0 flex-1">
          <Section
            title="API keys"
            aside={
              <Link href="/dashboard/keys" className={buttonClass("control")}>
                Create key
              </Link>
            }
          >
            {keys.length === 0 ? (
              <Row>
                <Muted>No keys yet. Create one for each overlay, bot or agent.</Muted>
              </Row>
            ) : (
              keys.slice(0, 4).map((key) => (
                <Row key={key.id}>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate text-[13px] font-medium text-(--text)">{key.name ?? "API key"}</span>
                    <span className="sk-mono text-[11px] text-(--text-3)">{key.start}…</span>
                  </div>
                  <Muted>{key.lastUsedAt ? `Used ${timeAgo(key.lastUsedAt)}` : "Never used"}</Muted>
                  <RevokeKeyButton id={key.id} name={key.name ?? "API key"} />
                </Row>
              ))
            )}
            <p className="border-t border-(--line) pt-3 text-xs leading-[18px] text-(--text-3)">
              Keys are shown once. Revoking a key disconnects anything using it right away.
            </p>
          </Section>
        </div>

        {doneCount < steps.length ? (
          <div className="w-100 shrink-0">
            <Section title="Get started" aside={<Muted>{`${doneCount} of ${steps.length} done`}</Muted>}>
              {steps.map((step, index) => (
                <div key={step.title} className="flex gap-3 border-t border-(--line) py-3.5">
                  <span
                    className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                      step.done ? "sk-grain bg-(--accent) text-white" : "border border-[#707070] text-(--text-2)"
                    }`}
                  >
                    {step.done ? "✓" : index + 1}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <span className={`text-[13px] font-medium ${step.done ? "text-(--text-3)" : "text-(--text)"}`}>{step.title}</span>
                    {index === 2 && !step.done ? (
                      <div className="flex items-start gap-2">
                        <pre className="sk-mono flex-1 overflow-x-auto rounded-(--r) border border-(--line) bg-(--surface-inset) px-2.5 py-2 text-[11px] leading-[17px] text-(--text-2)">
                          {`npm i @signal-kit/client\n\nkit.on("*", (e) => console.log(e))`}
                        </pre>
                        <CopyButton value="npm i @signal-kit/client" />
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </Section>
          </div>
        ) : null}
      </div>
    </>
  );
}
