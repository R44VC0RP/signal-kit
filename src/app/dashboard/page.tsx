import Link from "next/link";
import { ConnectButton, type ProviderId } from "@/components/AuthButtons";
import { CopyButton, RevokeKeyButton } from "@/components/dashboard/actions";
import { ConnectionStatus } from "@/components/dashboard/ConnectionStatus";
import { PLATFORM_NAME, PlatformTile } from "@/components/dashboard/PlatformLogo";
import { buttonClass, Muted, PageHeader, Row, Section, Status } from "@/components/dashboard/ui";
import type { Platform } from "@/db/schema";
import { enabledProviders, loadApiKeys, loadConnections, requireDashboardUser } from "@/lib/dashboard";
import { listOverlays } from "@/lib/overlays/store";
import { listStreams } from "@/lib/streams/store";
import { totals } from "@/lib/streams/summary";
import { timeAgo } from "@/lib/format";

const PROVIDER: Record<Platform, ProviderId> = { twitch: "twitch", youtube: "google", x: "twitter" };
const PLATFORM_BLURB: Record<Platform, string> = {
  twitch: "Follows, subs, cheers, raids and chat",
  youtube: "Live chat, Super Chats and memberships",
  x: "Live chat, follows and broadcasts",
};

export default async function OverviewPage() {
  const user = await requireDashboardUser();
  const [connections, keys, overlays, [lastStream]] = await Promise.all([loadConnections(user.id), loadApiKeys(), listOverlays(user.id), listStreams(user.id, 1)]);
  const last = lastStream ? totals(lastStream.summary) : null;
  const providers = enabledProviders();
  const missing = (["twitch", "youtube", "x"] as const).filter((platform) => !connections.some((c) => c.platform === platform));
  const listened = keys.some((key) => key.lastUsedAt);
  const steps = [
    { title: "Connect an account", done: connections.length > 0 },
    { title: "Create an API key", done: keys.length > 0 },
    { title: "Listen for events", done: listened },
  ];
  const doneCount = steps.filter((step) => step.done).length;
  // Streamers: from sign-up to an overlay on stream. Developers see the API checklist instead
  // once they've created a key.
  const firstOverlay = overlays[0];
  const streamSteps = [
    {
      title: "Connect a platform",
      detail: connections.length > 0 ? connectedSummary(connections.map((c) => c.platform)) : "Twitch, YouTube or X",
      done: connections.length > 0,
      action: { href: "/dashboard/connections", label: "Connect" },
    },
    {
      title: "Create an overlay",
      detail: firstOverlay ? `${firstOverlay.name}${overlays.length > 1 ? ` and ${overlays.length - 1} more` : ""}` : "Alerts, chat or an event list",
      done: overlays.length > 0,
      action: { href: "/dashboard/overlays", label: "Create" },
    },
    {
      title: "Add it to OBS",
      detail: "Paste one link as a browser source.",
      done: overlays.some((overlay) => overlay.lastSeenAt),
      action: { href: firstOverlay ? `/studio/${firstOverlay.id}?setup=1` : "/dashboard/overlays", label: "Add to OBS" },
    },
    {
      title: "Send a test alert",
      detail: "See it on stream before you go live.",
      done: overlays.some((overlay) => overlay.lastTestAt),
      action: { href: firstOverlay ? `/studio/${firstOverlay.id}?setup=1` : "/dashboard/overlays", label: "Send test" },
    },
  ];
  const streamDone = streamSteps.filter((step) => step.done).length;
  const currentStep = streamSteps.findIndex((step) => !step.done);

  return (
    <>
      <PageHeader title="Overview" description="Your connected accounts, overlays and the keys your apps use to listen." />

      {streamDone < streamSteps.length ? (
        <Section title="Get on stream" aside={<Muted>{`${streamDone} of ${streamSteps.length} done`}</Muted>}>
          <div className="grid grid-cols-4 gap-3">
            {streamSteps.map((step, index) => {
              const current = index === currentStep;
              return (
                <div
                  key={step.title}
                  className={`flex flex-col gap-1.5 border-t-2 pt-4 pr-5 pb-1 ${step.done ? "border-(--accent)" : current ? "border-(--text-3)" : "border-(--line-strong)"}`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                        step.done ? "sk-grain bg-(--accent) text-white" : current ? "border border-(--text-2) text-(--text)" : "border border-[#707070] text-(--text-3)"
                      }`}
                    >
                      {step.done ? "✓" : index + 1}
                    </span>
                    <span className={`text-[13px] ${step.done ? "font-medium text-(--text-3)" : current ? "font-semibold text-(--text)" : "font-medium text-(--text-2)"}`}>
                      {step.title}
                    </span>
                  </div>
                  <span className="pl-7.5 text-xs leading-[18px] text-(--text-3)">{step.detail}</span>
                  {!step.done ? (
                    <div className="pt-2 pl-7.5">
                      <Link
                        href={step.action.href}
                        aria-disabled={!current}
                        className={`${buttonClass(current ? "primary" : "control")} ${current ? "" : "pointer-events-none opacity-50"}`}
                      >
                        {step.action.label}
                      </Link>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </Section>
      ) : null}

      {lastStream && last ? (
        <Section
          title={lastStream.endedAt ? "Last stream" : "Live now"}
          aside={
            <Link href={`/dashboard/streams/${lastStream.id}`} className={buttonClass("control")}>
              {lastStream.endedAt ? "View stream" : "Watch stats"}
            </Link>
          }
        >
          <Row>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-[13px] font-medium text-(--text)">{lastStream.title ?? "Untitled stream"}</span>
              <Muted>{lastStream.endedAt ? timeAgo(lastStream.startedAt) : "Live"}</Muted>
            </div>
            {[
              ["Peak viewers", last.peakViewers],
              ["Chatters", last.chatters],
              ["New followers", last.follows],
              ["Subs", last.subs],
            ].map(([label, value]) => (
              <div key={label} className="flex w-24 shrink-0 flex-col items-end gap-0.5">
                <span className="sk-mono text-[13px] text-(--text)">{Number(value).toLocaleString("en")}</span>
                <Muted>{label}</Muted>
              </div>
            ))}
          </Row>
        </Section>
      ) : null}

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

        {keys.length > 0 && doneCount < steps.length ? (
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

function connectedSummary(platforms: Platform[]) {
  const names = [...new Set(platforms)].map((platform) => PLATFORM_NAME[platform]);
  return `${names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0]} connected`;
}
