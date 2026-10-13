import Link from "next/link";
import { PlatformLogo } from "@/components/dashboard/PlatformLogo";
import { AutoRefresh } from "@/components/dashboard/streams/AutoRefresh";
import { compact, StreamsTrend } from "@/components/dashboard/streams/charts";
import { Delta, Stat, StatGrid, formatDuration, formatTips, LiveDot } from "@/components/dashboard/streams/stats";
import { Muted, PageHeader, Row, Section } from "@/components/dashboard/ui";
import type { Platform } from "@/db/schema";
import { requireDashboardUser } from "@/lib/dashboard";
import { durationMs, listStreams, periodTotals, regulars } from "@/lib/streams/store";
import { totals } from "@/lib/streams/summary";

const DAY = 24 * 60 * 60 * 1000;

export default async function StreamsPage() {
  const user = await requireDashboardUser();
  const [streams, regularChatters] = await Promise.all([listStreams(user.id, 120), regulars(user.id, 10)]);
  const now = new Date().getTime();
  const last30 = streams.filter((stream) => now - Date.parse(stream.startedAt) < 30 * DAY);
  const prev30 = streams.filter((stream) => {
    const age = now - Date.parse(stream.startedAt);
    return age >= 30 * DAY && age < 60 * DAY;
  });
  const current = periodTotals(last30, now);
  const previous = periodTotals(prev30, now);
  const live = streams.find((stream) => !stream.endedAt);
  const perStream = (value: number, count: number) => (count ? Math.round(value / count) : 0);

  return (
    <>
      {live ? <AutoRefresh /> : null}
      <PageHeader title="Streams" description="Every stream since you connected: viewers, chat and support on each platform." />

      {streams.length === 0 ? (
        <Section title="No streams yet">
          <div className="flex flex-col gap-2 border-t border-(--line) py-5 text-[13px] leading-5 text-(--text-2)">
            <p>Go live with a connected account and your stream shows up here on its own: viewers, chatters, messages, follows, subs, bits and tips, per platform.</p>
            <p className="text-(--text-3)">
              YouTube streams are tracked while an overlay or app is connected, because that&apos;s when Signal Kit reads your YouTube chat.
            </p>
          </div>
        </Section>
      ) : (
        <>
          <Section title="Last 30 days" aside={<Muted>Compared with the 30 days before</Muted>}>
            <StatGrid>
              <Stat label="Streams" value={String(current.streams)} delta={<Delta now={current.streams} before={previous.streams} />} />
              <Stat label="Hours live" value={current.hours.toFixed(1)} delta={<Delta now={current.hours} before={previous.hours} />} />
              <Stat label="Average viewers" value={compact(current.avgViewers)} delta={<Delta now={current.avgViewers} before={previous.avgViewers} />} />
              <Stat label="Peak viewers" value={compact(current.peakViewers)} delta={<Delta now={current.peakViewers} before={previous.peakViewers} />} />
              <Stat
                label="Chatters per stream"
                value={compact(perStream(current.chatters, current.streams))}
                delta={<Delta now={perStream(current.chatters, current.streams)} before={perStream(previous.chatters, previous.streams)} />}
              />
              <Stat label="New chatters" value={compact(current.newChatters)} delta={<Delta now={current.newChatters} before={previous.newChatters} />} />
              <Stat label="New followers" value={compact(current.follows)} delta={<Delta now={current.follows} before={previous.follows} />} />
              <Stat label="Subs" value={compact(current.subs)} delta={<Delta now={current.subs} before={previous.subs} />} />
            </StatGrid>
            {current.bits > 0 || Object.keys(current.tips).length > 0 ? (
              <p className="border-t border-(--line) pt-3 text-xs text-(--text-3)">
                Support: {[current.bits ? `${current.bits.toLocaleString("en")} bits` : null, formatTips(current.tips)].filter(Boolean).join(" · ")}
              </p>
            ) : null}
          </Section>

          {streams.length > 1 ? (
            <Section title="Chatters per stream" aside={<Muted>By platform, latest on the right</Muted>}>
              <StreamsTrend streams={streams} />
            </Section>
          ) : null}

          <Section title="All streams" aside={<Muted>{`${streams.length} streams`}</Muted>}>
            <div className="sk-mono grid grid-cols-[1fr_repeat(5,72px)] gap-3 pb-2 text-right text-[11px] tracking-[0.04em] text-(--text-3) uppercase">
              <span className="text-left">Stream</span>
              <span>Peak</span>
              <span>Avg</span>
              <span>Chatters</span>
              <span>Follows</span>
              <span>Subs</span>
            </div>
            {streams.map((stream) => {
              const t = totals(stream.summary);
              const platforms = (Object.keys(stream.summary.platforms) as Platform[]).filter((p) => stream.summary.platforms[p]?.startedAt);
              const date = new Date(stream.startedAt);
              return (
                <Link key={stream.id} href={`/dashboard/streams/${stream.id}`} className="block hover:bg-(--hover)">
                  <div className="grid min-h-14 grid-cols-[1fr_repeat(5,72px)] items-center gap-3 border-t border-(--line) py-2.5">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex w-24 shrink-0 flex-col">
                        <span className="text-[13px] font-medium text-(--text)">{date.toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" })}</span>
                        <span className="sk-mono text-[11px] text-(--text-3)">
                          {stream.endedAt ? formatDuration(durationMs(stream, now)) : <LiveDot />}
                        </span>
                      </div>
                      <div className="flex min-w-0 flex-col gap-1">
                        <span className="truncate text-[13px] text-(--text-2)">{stream.title ?? "Untitled stream"}</span>
                        <span className="flex items-center gap-1.5">
                          {platforms.map((p) => (
                            <PlatformLogo key={p} platform={p} size={12} />
                          ))}
                        </span>
                      </div>
                    </div>
                    <Num value={t.peakViewers} />
                    <Num value={t.avgViewers} />
                    <Num value={t.chatters} />
                    <Num value={t.follows} />
                    <Num value={t.subs} />
                  </div>
                </Link>
              );
            })}
          </Section>

          {regularChatters.length > 0 ? (
            <Section title="Your regulars" aside={<Muted>Chatted in the most streams</Muted>}>
              {regularChatters.map((chatter) => (
                <Row key={`${chatter.platform}:${chatter.name}`} className="min-h-11">
                  <PlatformLogo platform={chatter.platform} size={13} />
                  <span className="flex-1 truncate text-[13px] text-(--text)">{chatter.name}</span>
                  <span className="sk-mono w-28 text-right text-xs text-(--text-2)">{chatter.streams === 1 ? "1 stream" : `${chatter.streams} streams`}</span>
                  <span className="sk-mono w-28 text-right text-xs text-(--text-3)">{chatter.messages.toLocaleString("en")} messages</span>
                </Row>
              ))}
            </Section>
          ) : null}
        </>
      )}
    </>
  );
}

function Num({ value }: { value: number }) {
  return <span className={`sk-mono text-right text-[13px] ${value ? "text-(--text)" : "text-(--text-3)"}`}>{compact(value)}</span>;
}
