import { and, desc, eq, ne } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlatformLogo } from "@/components/dashboard/PlatformLogo";
import { compact } from "@/components/dashboard/streams/charts";
import { formatDuration } from "@/components/dashboard/streams/stats";
import { getDb } from "@/db";
import { chatters, connections, users } from "@/db/schema";
import { userIdForSlug } from "@/lib/notify/settings";
import { durationMs, listStreams, periodTotals } from "@/lib/streams/store";
import { totals } from "@/lib/streams/summary";

/**
 * A streamer's opt-in public stats page: recent streams, the chat leaderboard and top emotes.
 * Only public, aggregate information; no tip amounts by name. YouTube viewer names are left out
 * (YouTube API data may not be republished like this).
 */

type Params = { params: Promise<{ slug: string }> };

async function load(slug: string) {
  const userId = await userIdForSlug(slug.toLowerCase());
  if (!userId) {
    return null;
  }
  const db = getDb();
  const [[user], channels, streamRows, leaders] = await Promise.all([
    db.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1),
    db
      .select({ platform: connections.platform, displayName: connections.displayName })
      .from(connections)
      .where(and(eq(connections.userId, userId), eq(connections.status, "active"), ne(connections.role, "bot"))),
    listStreams(userId, 30),
    db
      .select({ platform: chatters.platform, name: chatters.name, messages: chatters.messages, streams: chatters.streams })
      .from(chatters)
      .where(and(eq(chatters.userId, userId), ne(chatters.platform, "youtube")))
      .orderBy(desc(chatters.messages))
      .limit(20),
  ]);
  return { name: channels.find((c) => c.platform === "twitch")?.displayName ?? user?.name ?? slug, channels, streams: streamRows.filter((s) => s.endedAt), leaders };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const data = await load((await params).slug);
  return data ? { title: `${data.name} · Stream stats`, description: `Recent streams, chat leaderboard and top emotes for ${data.name}.` } : { title: "Not found" };
}

export default async function PublicStatsPage({ params }: Params) {
  const data = await load((await params).slug);
  if (!data) {
    notFound();
  }
  const now = new Date().getTime();
  const recent = data.streams.filter((stream) => now - Date.parse(stream.startedAt) < 30 * 86_400_000);
  const period = periodTotals(recent, now);
  const emotes = new Map<string, { url: string; count: number }>();
  for (const stream of data.streams.slice(0, 10)) {
    for (const [name, value] of Object.entries(stream.summary.emotes ?? {})) {
      const entry = emotes.get(name) ?? { url: value.url, count: 0 };
      entry.count += value.count;
      emotes.set(name, entry);
    }
  }
  const topEmotes = [...emotes].sort(([, a], [, b]) => b.count - a.count).slice(0, 12);
  const link = (platform: string, name: string) =>
    platform === "twitch" ? `https://twitch.tv/${encodeURIComponent(name.toLowerCase())}` : platform === "x" ? `https://x.com/${encodeURIComponent(name.replace(/^@/, ""))}` : null;

  return (
    <div className="sk-app flex min-h-dvh justify-center px-6 py-14">
      <main className="flex w-full max-w-200 flex-col gap-12">
        <header className="flex flex-col gap-3">
          <h1 className="sk-brand text-[40px] leading-[46px] font-semibold tracking-[-0.02em] text-(--text)">{data.name}</h1>
          <div className="flex flex-wrap items-center gap-3">
            {data.channels.map((channel) => {
              const href = link(channel.platform, channel.displayName);
              const content = (
                <>
                  <PlatformLogo platform={channel.platform} size={14} />
                  {channel.displayName}
                </>
              );
              return href ? (
                <a key={`${channel.platform}${channel.displayName}`} href={href} className="inline-flex items-center gap-1.5 text-[13px] text-(--text-2) hover:text-(--text)">
                  {content}
                </a>
              ) : (
                <span key={`${channel.platform}${channel.displayName}`} className="inline-flex items-center gap-1.5 text-[13px] text-(--text-2)">
                  {content}
                </span>
              );
            })}
          </div>
        </header>

        <section className="grid grid-cols-4 border-t border-(--line)">
          {[
            ["Streams (30 days)", String(period.streams)],
            ["Hours live", period.hours.toFixed(1)],
            ["Average viewers", compact(period.avgViewers)],
            ["Peak viewers", compact(period.peakViewers)],
          ].map(([label, value], index) => (
            <div key={label} className={`flex flex-col gap-1 border-b border-(--line) py-4 ${index ? "border-l pl-4" : ""}`}>
              <span className="text-xs text-(--text-3)">{label}</span>
              <span className="sk-brand text-[26px] leading-8 font-semibold text-(--text)">{value}</span>
            </div>
          ))}
        </section>

        <section className="flex flex-col">
          <h2 className="pb-3 text-[13px] font-semibold text-(--text)">Recent streams</h2>
          {data.streams.length === 0 ? <p className="border-t border-(--line) py-4 text-[13px] text-(--text-3)">No streams yet.</p> : null}
          {data.streams.slice(0, 10).map((stream) => {
            const t = totals(stream.summary);
            return (
              <div key={stream.id} className="flex min-h-14 items-center gap-4 border-t border-(--line) py-2">
                <div className="flex w-28 shrink-0 flex-col">
                  <span className="text-[13px] font-medium text-(--text)">{new Date(stream.startedAt).toLocaleDateString("en", { month: "short", day: "numeric" })}</span>
                  <span className="sk-mono text-[11px] text-(--text-3)">{formatDuration(durationMs(stream, now))}</span>
                </div>
                <span className="min-w-0 flex-1 truncate text-[13px] text-(--text-2)">{stream.title ?? "Untitled stream"}</span>
                <span className="sk-mono w-28 text-right text-xs text-(--text-2)">{`${compact(t.peakViewers)} peak`}</span>
                <span className="sk-mono w-28 text-right text-xs text-(--text-3)">{`${compact(t.chatters)} chatters`}</span>
              </div>
            );
          })}
        </section>

        <div className="grid grid-cols-2 gap-12">
          <section className="flex flex-col">
            <h2 className="pb-3 text-[13px] font-semibold text-(--text)">Chat leaderboard</h2>
            {data.leaders.map((leader, index) => (
              <div key={`${leader.platform}${leader.name}`} className="flex min-h-10 items-center gap-3 border-t border-(--line)">
                <span className="sk-mono w-6 text-xs text-(--text-3)">{index + 1}</span>
                <PlatformLogo platform={leader.platform} size={12} />
                <span className="min-w-0 flex-1 truncate text-[13px] text-(--text)">{leader.name}</span>
                <span className="sk-mono text-xs text-(--text-2)">{leader.messages.toLocaleString("en")}</span>
              </div>
            ))}
            {data.leaders.length === 0 ? <p className="border-t border-(--line) py-4 text-[13px] text-(--text-3)">No chat yet.</p> : null}
          </section>
          <section className="flex flex-col">
            <h2 className="pb-3 text-[13px] font-semibold text-(--text)">Top emotes</h2>
            <div className="grid grid-cols-4 gap-2 border-t border-(--line) pt-3">
              {topEmotes.map(([name, value]) => (
                <div key={name} className="flex flex-col items-center gap-1 py-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={value.url} alt={name} title={name} className="h-10 w-auto" referrerPolicy="no-referrer" />
                  <span className="sk-mono text-[11px] text-(--text-3)">{compact(value.count)}</span>
                </div>
              ))}
            </div>
            {topEmotes.length === 0 ? <p className="py-4 text-[13px] text-(--text-3)">No emotes yet.</p> : null}
          </section>
        </div>

        <footer className="border-t border-(--line) pt-4 text-xs text-(--text-3)">
          Stats by{" "}
          <Link href="/" className="underline hover:text-(--text)">
            Signal Kit
          </Link>
          .
        </footer>
      </main>
    </div>
  );
}
