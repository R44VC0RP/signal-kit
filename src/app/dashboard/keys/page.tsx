import { CreateKeyForm, RevokeKeyButton } from "@/components/dashboard/actions";
import { Muted, PageHeader, Row, Section } from "@/components/dashboard/ui";
import { loadApiKeys, relayUrls, requireDashboardUser } from "@/lib/dashboard";
import { shortDate, timeAgo } from "@/lib/format";

export default async function ApiKeysPage() {
  await requireDashboardUser();
  const keys = await loadApiKeys();
  const { wsUrl } = relayUrls();

  return (
    <>
      <PageHeader
        title="API keys"
        description="Keys let your overlays, bots and agents listen. They never see your platform passwords or tokens."
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-[13px] font-semibold text-(--text)">Create a key</h2>
        <CreateKeyForm />
      </section>

      <Section title="Your keys" aside={<Muted>{`${keys.length} active`}</Muted>}>
        <div className="flex h-8 items-center gap-3.5 border-t border-(--line) text-xs text-(--text-3)">
          <span className="flex-1">Name</span>
          <span className="w-50 shrink-0">Key</span>
          <span className="w-30 shrink-0">Created</span>
          <span className="w-30 shrink-0">Last used</span>
          <span className="w-24 shrink-0" />
        </div>
        {keys.length === 0 ? (
          <Row>
            <Muted>No keys yet.</Muted>
          </Row>
        ) : (
          keys.map((key) => (
            <Row key={key.id}>
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-(--text)">{key.name ?? "API key"}</span>
              <span className="sk-mono w-50 shrink-0 text-xs text-(--text-2)">{key.start}…</span>
              <span className="w-30 shrink-0 text-[13px] text-(--text-2)">{shortDate(key.createdAt)}</span>
              <span className="w-30 shrink-0 text-[13px] text-(--text-2)">{timeAgo(key.lastUsedAt)}</span>
              <span className="flex w-24 shrink-0 justify-end">
                <RevokeKeyButton id={key.id} name={key.name ?? "API key"} />
              </span>
            </Row>
          ))
        )}
      </Section>

      <p className="text-xs leading-[18px] text-(--text-3)">
        Revoking a key disconnects anything using it right away. Use the{" "}
        <code className="sk-mono text-(--text-2)">@signal-kit/client</code> SDK, or connect to{" "}
        <code className="sk-mono text-(--text-2)">{wsUrl}</code> and send{" "}
        <code className="sk-mono text-(--text-2)">{`{"type":"auth","token":"…"}`}</code> as the first message.
      </p>
    </>
  );
}
