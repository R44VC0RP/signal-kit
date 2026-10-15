import Link from "next/link";
import { notFound } from "next/navigation";
import { PLATFORM_NAME, PlatformSlot } from "@/components/dashboard/PlatformLogo";
import { AutoRefresh } from "@/components/dashboard/streams/AutoRefresh";
import { compact, TimelineChart } from "@/components/dashboard/streams/charts";
import { Delta, formatDuration, formatTips, LiveDot, Stat, StatGrid } from "@/components/dashboard/streams/stats";
import { buttonClass, Muted, PageHeader, Row, Section } from "@/components/dashboard/ui";
import type { Platform } from "@/db/schema";
import { requireDashboardUser } from "@/lib/dashboard";
import { durationMs, getStream, previousStream, topChatters } from "@/lib/streams/store";
import { supportScore, topEmotes, totals, type PlatformStats } from "@/lib/streams/summary";

const KIND_LABEL: Record<string, string> = {
  follow: "followed",
  subscription: "subscribed",
  "subscription.gift": "gifted subs",
  tip: "tipped",
  raid: "raided",
  redemption: "redeemed",
};

export default async function StreamPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireDashboardUser();
  const stream = await getStream(user.id, (await params).id);
  if (!stream) {
    notFound();
  }
  const [previous, chatters] = await Promise.all([previousStream(user.id, stream.startedAt), topChatters(user.id, stream.id, 15)]);
  const now = new Date().getTime();
  const t = totals(stream.summary);
  const p = previous ? totals(previous.summary) : null;
  const start = new Date(stream.startedAt);
  const platforms = (["twitch", "youtube", "x"] as Platform[]).filter((platform) => stream.summary.platforms[platform]);
  const supporters = Object.values(stream.summary.supporters)
    .sort((a, b) => supportScore(b) - supportScore(a))
    .slice(0, 10);
  const moments = [...stream.summary.highlights].reverse();
  const at = (iso: string) => formatDuration(Math.max(0, Date.parse(iso) - start.getTime()));

  return (
    <>
      {stream.endedAt ? null : <AutoRefresh />}
      <div className="-mb-6">
        <Link href="/dashboard/streams" className="text-[13px] text-(--text-3) hover:text-(--text)">
          ← Streams
        </Link>
      </div>
      <PageHeader
        title={stream.title ?? "Untitled stream"}
        description={`${start.toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric" })} · ${start.toLocaleTimeString("en", { hour: "numeric", minute: "2-digit" })}${
          stream.endedAt ? ` – ${new Date(stream.endedAt).toLocaleTimeString("en", { hour: "numeric", minute: "2-digit" })}` : ""
        } · ${formatDuration(durationMs(stream, now))}`}
        actions={stream.endedAt ? null : <LiveDot />}
      />

      <Section title="Overview" aside={<Muted>{previous ? "Compared with your previous stream" : "Your first tracked stream"}</Muted>}>
        <StatGrid>
          <Stat label="Peak viewers" value={compact(t.peakViewers)} delta={<Delta now={t.peakViewers} before={p?.peakViewers} />} />
          <Stat label="Average viewers" value={compact(t.avgViewers)} delta={<Delta now={t.avgViewers} before={p?.avgViewers} />} />
          <Stat label="Chatters" value={compact(t.chatters)} delta={<Delta now={t.chatters} before={p?.chatters} />} sub={t.newChatters ? `${t.newChatters} new` : undefined} />
          <Stat label="Messages" value={compact(t.messages)} delta={<Delta now={t.messages} before={p?.messages} />} />
          <Stat label="New followers" value={compact(t.follows)} delta={<Delta now={t.follows} before={p?.follows} />} />
          <Stat label="Subs" value={compact(t.subs)} delta={<Delta now={t.subs} before={p?.subs} />} sub={t.giftedSubs ? `${t.giftedSubs} gifted` : undefined} />
          <Stat label="Bits" value={compact(t.bits)} delta={<Delta now={t.bits} before={p?.bits} />} />
          <Stat label="Tips" value={formatTips(t.tips) || "–"} sub={t.raids ? `${t.raids} raid${t.raids > 1 ? "s" : ""}` : undefined} />
        </StatGrid>
        <p className="border-t border-(--line) pt-3 text-xs text-(--text-3)">Calculated by Signal Kit from your stream events. Not provided by YouTube.</p>
      </Section>

      <Section title="Viewers and chat">
        <TimelineChart summary={stream.summary} startedAt={stream.startedAt} />
      </Section>

      <Section title="By platform" aside={<Muted>{"Calculated by Signal Kit. Not provided by YouTube."}</Muted>}>
        <div className="sk-mono grid grid-cols-[1fr_repeat(7,64px)] gap-2 pb-2 text-right text-[11px] tracking-[0.04em] text-(--text-3) uppercase">
          <span className="text-left">Platform</span>
          <span>{platforms.includes("youtube") ? "Peak*" : "Peak"}</span>
          <span>{platforms.includes("youtube") ? "Avg*" : "Avg"}</span>
          <span>Chatters</span>
          <span>New</span>
          <span>Msgs</span>
          <span>Follows</span>
          <span>Subs</span>
        </div>
        {platforms.map((platform) => {
          const s = stream.summary.platforms[platform] as PlatformStats;
          return (
            <div key={platform} className="grid min-h-14 grid-cols-[1fr_repeat(7,64px)] items-center gap-2 border-t border-(--line) py-2.5">
              <div className="flex min-w-0 items-center gap-2">
                <PlatformSlot platform={platform} size={14} />
                <div className="flex min-w-0 flex-col">
                  <span className="text-[13px] font-medium text-(--text)">{PLATFORM_NAME[platform]}</span>
                  <span className="truncate text-[11px] text-(--text-3)">
                    {[s.category, s.live ? "live now" : s.endedAt && s.startedAt ? formatDuration(Date.parse(s.endedAt) - Date.parse(s.startedAt)) : null].filter(Boolean).join(" · ") ||
                      "Activity only"}
                  </span>
                </div>
              </div>
              <Cell value={s.peakViewers} empty={platform === "x" ? "n/a" : undefined} />
              <Cell value={s.viewerSamples ? Math.round(s.viewerSum / s.viewerSamples) : 0} empty={platform === "x" ? "n/a" : undefined} />
              <Cell value={s.chatters} />
              <Cell value={s.newChatters} />
              <Cell value={s.messages} />
              <Cell value={s.follows} />
              <Cell value={s.subs} />
            </div>
          );
        })}
        {platforms.includes("youtube") ? (
          <p className="border-t border-(--line) pt-3 text-xs text-(--text-3)">
            * YouTube peak and average viewers are calculated by Signal Kit from samples of YouTube&apos;s concurrent viewer count, taken every minute. Not
            provided by YouTube.
          </p>
        ) : null}
        {platforms.includes("x") ? <p className="border-t border-(--line) pt-3 text-xs text-(--text-3)">X doesn&apos;t share viewer counts with apps, so X shows chat and follows only.</p> : null}
      </Section>

      <div className="grid grid-cols-2 gap-12">
        <Section title="Top chatters" aside={<Muted>{`${t.chatters} total`}</Muted>}>
          {chatters.length === 0 ? (
            <Row>
              <Muted>No chat yet.</Muted>
            </Row>
          ) : (
            chatters.map((chatter) => {
              const firstTime = chatter.firstSeenAt && chatter.firstSeenAt.getTime() >= start.getTime();
              return (
                <Row key={`${chatter.platform}:${chatter.chatterId}`} className="min-h-11">
                  <PlatformSlot platform={chatter.platform} size={13} />
                  <span className="min-w-0 flex-1 truncate text-[13px] text-(--text)">{chatter.name}</span>
                  {firstTime ? <span className="rounded-[4px] bg-(--accent-soft) px-1.5 py-0.5 text-[11px] text-(--accent-text)">First stream</span> : null}
                  <span className="sk-mono w-20 text-right text-xs text-(--text-2)">{chatter.messages.toLocaleString("en")}</span>
                </Row>
              );
            })
          )}
        </Section>
        <Section title="Top supporters">
          {supporters.length === 0 ? (
            <Row>
              <Muted>No subs, bits or tips this stream.</Muted>
            </Row>
          ) : (
            supporters.map((s) => (
              <Row key={`${s.platform}:${s.name}`} className="min-h-11">
                <PlatformSlot platform={s.platform} size={13} />
                <span className="min-w-0 flex-1 truncate text-[13px] text-(--text)">{s.name}</span>
                <span className="sk-mono text-right text-xs text-(--text-2)">
                  {[s.gifts ? `${s.gifts} gifted` : null, s.subs ? "sub" : null, s.bits ? `${s.bits.toLocaleString("en")} bits` : null, formatTips(s.tips) || null].filter(Boolean).join(" · ")}
                </span>
              </Row>
            ))
          )}
        </Section>
      </div>

      {topEmotes(stream.summary).length ? (
        <Section title="Top emotes" aside={<Muted>Twitch, BTTV, FFZ and 7TV emotes used in chat</Muted>}>
          <div className="grid grid-cols-10 gap-2 border-t border-(--line) pt-4">
            {topEmotes(stream.summary, 20).map((emote) => (
              <div key={emote.name} title={emote.name} className="flex flex-col items-center gap-1.5 py-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={emote.url} alt={emote.name} className="h-9 w-auto" referrerPolicy="no-referrer" />
                <span className="sk-mono text-[11px] text-(--text-3)">{compact(emote.count)}</span>
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      <Section title="Moments" aside={<Muted>Follows, subs, bits, tips, raids and redemptions</Muted>}>
        {moments.length === 0 ? (
          <Row>
            <Muted>Nothing yet.</Muted>
          </Row>
        ) : (
          moments.slice(0, 100).map((moment, index) => (
            <Row key={index} className="min-h-10">
              <span className="sk-mono w-16 shrink-0 text-xs text-(--text-3)">{at(moment.at)}</span>
              <PlatformSlot platform={moment.platform} size={12} />
              <span className="min-w-0 flex-1 truncate text-[13px] text-(--text-2)">
                <span className="font-medium text-(--text)">{moment.name}</span>{" "}
                {moment.kind === "tip" && moment.detail?.endsWith("bits") ? "cheered" : (KIND_LABEL[moment.kind] ?? moment.kind)}
                {moment.detail ? <span className="text-(--text-3)"> · {moment.detail}</span> : null}
              </span>
            </Row>
          ))
        )}
        {moments.length > 100 ? <p className="border-t border-(--line) pt-3 text-xs text-(--text-3)">{`Showing the latest 100 of ${moments.length}.`}</p> : null}
      </Section>

      <div>
        <Link href="/dashboard/streams" className={buttonClass("control")}>
          All streams
        </Link>
      </div>
    </>
  );
}

function Cell({ value, empty }: { value: number; empty?: string }) {
  return <span className={`sk-mono text-right text-[13px] ${value ? "text-(--text)" : "text-(--text-3)"}`}>{value ? compact(value) : (empty ?? "0")}</span>;
}
