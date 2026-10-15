"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PlatformSlot } from "@/components/dashboard/PlatformLogo";
import { buttonClass, Muted, Section } from "@/components/dashboard/ui";
import type { EventPlatform } from "@/lib/events/types";
import { emptyLiveTools, wheelResult, wheelSegments, type PublicLiveTools } from "@/lib/live/types";

type ChatLine = { id: string; platform: EventPlatform; name: string; message: string | null; at: string };

const inputClass =
  "h-8 w-full rounded-(--r) border border-(--line) bg-(--surface-inset) px-2.5 text-[13px] text-(--text) outline-none placeholder:text-(--text-3) focus:border-(--accent)";

/** Run chat polls, giveaways, the viewer queue and pinned messages across every platform. */
export function LiveTools() {
  const [tools, setTools] = useState<PublicLiveTools>(emptyLiveTools());
  const [chat, setChat] = useState<ChatLine[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/live").catch(() => null);
    if (response?.ok) {
      const json = (await response.json()) as { tools: PublicLiveTools; chat: ChatLine[] };
      setTools(json.tools);
      setChat(json.chat);
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(() => void refresh(), 0);
    const timer = setInterval(() => void refresh(), 1500);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [refresh]);

  const act = async (action: string, input: Record<string, unknown> = {}) => {
    setError(null);
    const response = await fetch("/api/live", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...input }) }).catch(() => null);
    const json = (await response?.json().catch(() => null)) as { tools?: PublicLiveTools; error?: string } | null;
    if (json?.tools) {
      setTools(json.tools);
    } else {
      setError(json?.error ?? "Something went wrong.");
    }
  };

  return (
    <>
      {error ? <p className="-mt-6 text-[13px] text-(--danger-text)">{error}</p> : null}
      <div className="grid grid-cols-2 gap-12">
        <div className="flex min-w-0 flex-col gap-10">
          <PollPanel tools={tools} act={act} />
          <GiveawayPanel tools={tools} act={act} />
          <WheelPanel tools={tools} act={act} />
        </div>
        <div className="flex min-w-0 flex-col gap-10">
          <QueuePanel tools={tools} act={act} />
          <ChatPanel tools={tools} chat={chat} act={act} />
        </div>
      </div>
      <p className="border-t border-(--line) pt-3 text-xs leading-[18px] text-(--text-3)">
        Viewers on Twitch, YouTube and X all take part through chat. Show them on stream with the Chat poll, Giveaway, Viewer queue and Chat highlight overlays from{" "}
        <Link href="/dashboard/overlays" className="underline hover:text-(--text)">
          Overlays
        </Link>
        .
      </p>
    </>
  );
}

type Act = (action: string, input?: Record<string, unknown>) => Promise<void>;

function PollPanel({ tools, act }: { tools: PublicLiveTools; act: Act }) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [duration, setDuration] = useState(120);
  const poll = tools.poll;
  return (
    <Section title="Chat poll" aside={<Muted>{poll ? (poll.status === "open" ? "Voting open" : "Closed") : "Viewers type 1, 2, 3…"}</Muted>}>
      <div className="flex flex-col gap-3 border-t border-(--line) pt-4">
        {poll ? (
          <>
            <span className="text-[13px] font-medium text-(--text)">{poll.question}</span>
            {poll.options.map((option, index) => {
              const percent = poll.totalVotes ? Math.round((option.votes / poll.totalVotes) * 100) : 0;
              return (
                <div key={index} className="relative flex h-8 items-center justify-between overflow-hidden rounded-(--r) bg-(--surface-inset) px-2.5 text-[13px]">
                  <span className="absolute inset-y-0 left-0 bg-(--accent-soft)" style={{ width: `${percent}%` }} />
                  <span className="relative text-(--text)">
                    <span className="sk-mono mr-2 text-(--text-3)">{index + 1}</span>
                    {option.label}
                  </span>
                  <span className="sk-mono relative text-xs text-(--text-2)">{`${percent}% · ${option.votes}`}</span>
                </div>
              );
            })}
            <span className="text-xs text-(--text-3)">{`${poll.totalVotes} votes · Counted by Signal Kit from chat, not by YouTube.`}</span>
            <div className="flex gap-2">
              {poll.status === "open" ? (
                <button type="button" className={buttonClass("primary")} onClick={() => void act("poll.end")}>
                  End poll
                </button>
              ) : null}
              <button type="button" className={buttonClass("control")} onClick={() => void act("poll.clear")}>
                {poll.status === "open" ? "Cancel" : "Clear"}
              </button>
            </div>
          </>
        ) : (
          <>
            <input className={inputClass} value={question} maxLength={140} placeholder="Question, e.g. What should we play next?" onChange={(event) => setQuestion(event.target.value)} />
            {options.map((option, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="sk-mono w-4 text-xs text-(--text-3)">{index + 1}</span>
                <input className={inputClass} value={option} maxLength={60} placeholder={`Option ${index + 1}`} onChange={(event) => setOptions(options.map((value, i) => (i === index ? event.target.value : value)))} />
                {options.length > 2 ? (
                  <button type="button" aria-label="Remove option" className={buttonClass("quiet")} onClick={() => setOptions(options.filter((_, i) => i !== index))}>
                    ✕
                  </button>
                ) : null}
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-2">
              {options.length < 6 ? (
                <button type="button" className={buttonClass("quiet")} onClick={() => setOptions([...options, ""])}>
                  Add option
                </button>
              ) : null}
              <span className="flex-1" />
              <select value={duration} onChange={(event) => setDuration(Number(event.target.value))} className={`${inputClass} w-auto`}>
                {[60, 120, 300, 600, 0].map((seconds) => (
                  <option key={seconds} value={seconds}>
                    {seconds === 0 ? "No time limit" : `${seconds / 60} min`}
                  </option>
                ))}
              </select>
              <button type="button" className={buttonClass("primary")} onClick={() => void act("poll.start", { question, options, durationSec: duration })}>
                Start poll
              </button>
            </div>
          </>
        )}
      </div>
    </Section>
  );
}

function GiveawayPanel({ tools, act }: { tools: PublicLiveTools; act: Act }) {
  const [title, setTitle] = useState("");
  const [keyword, setKeyword] = useState("!enter");
  const giveaway = tools.giveaway;
  return (
    <Section title="Giveaway" aside={<Muted>{giveaway ? `${giveaway.entries} entries · Counted by Signal Kit, not by YouTube` : "Viewers type a keyword to enter"}</Muted>}>
      <div className="flex flex-col gap-3 border-t border-(--line) pt-4">
        {giveaway ? (
          <>
            <div className="flex items-baseline justify-between">
              <span className="text-[13px] font-medium text-(--text)">{giveaway.title}</span>
              <span className="sk-mono text-xs text-(--text-3)">{giveaway.status === "open" ? `Open · ${giveaway.keyword}` : "Entries closed"}</span>
            </div>
            {giveaway.winners.length ? (
              <div className="flex flex-col gap-1.5">
                {[...giveaway.winners].reverse().map((winner, index) => (
                  <div key={`${winner.key}${winner.at}`} className="flex items-center gap-2 text-[13px]">
                    <span className="text-xs text-(--text-3)">{index === 0 ? "Winner" : "Earlier"}</span>
                    <PlatformSlot platform={winner.platform} size={13} />
                    <span className={index === 0 ? "font-semibold text-(--text)" : "text-(--text-2)"}>{winner.name}</span>
                  </div>
                ))}
              </div>
            ) : null}
            {giveaway.recent.length ? <span className="truncate text-xs text-(--text-3)">{`Latest: ${giveaway.recent.slice(0, 6).map((person) => person.name).join(", ")}`}</span> : null}
            <div className="flex flex-wrap gap-2">
              <button type="button" className={buttonClass("primary")} disabled={giveaway.entries === 0} onClick={() => void act("giveaway.draw")}>
                {giveaway.winners.length ? "Draw again" : "Draw winner"}
              </button>
              {giveaway.status === "open" ? (
                <button type="button" className={buttonClass("control")} onClick={() => void act("giveaway.close")}>
                  Close entries
                </button>
              ) : (
                <button type="button" className={buttonClass("control")} onClick={() => void act("giveaway.reopen")}>
                  Reopen
                </button>
              )}
              <button type="button" className={buttonClass("quiet")} onClick={() => void act("giveaway.clear")}>
                End giveaway
              </button>
            </div>
          </>
        ) : (
          <>
            <input className={inputClass} value={title} maxLength={100} placeholder="What's the prize? e.g. Steam key" onChange={(event) => setTitle(event.target.value)} />
            <div className="flex items-center gap-2">
              <input className={`${inputClass} sk-mono w-40`} value={keyword} maxLength={30} onChange={(event) => setKeyword(event.target.value)} />
              <span className="flex-1 text-xs text-(--text-3)">Keyword viewers type to enter</span>
              <button type="button" className={buttonClass("primary")} onClick={() => void act("giveaway.start", { title, keyword })}>
                Start giveaway
              </button>
            </div>
          </>
        )}
      </div>
    </Section>
  );
}

function QueuePanel({ tools, act }: { tools: PublicLiveTools; act: Act }) {
  const queue = tools.queue;
  return (
    <Section title="Viewer queue" aside={<Muted>{queue.open ? `Open · ${queue.entries.length} waiting` : "Viewers type !join"}</Muted>}>
      <div className="flex flex-col gap-3 border-t border-(--line) pt-4">
        {queue.current ? (
          <div className="flex items-center gap-2 rounded-(--r) bg-(--accent-soft) px-2.5 py-2 text-[13px]">
            <span className="text-xs text-(--accent-text)">Now</span>
            <PlatformSlot platform={queue.current.platform} size={13} />
            <span className="flex-1 font-medium text-(--text)">{queue.current.name}</span>
          </div>
        ) : null}
        {queue.entries.slice(0, 12).map((entry, index) => (
          <div key={entry.key} className="flex items-center gap-2 text-[13px]">
            <span className="sk-mono w-5 text-xs text-(--text-3)">{index + 1}</span>
            <PlatformSlot platform={entry.platform} size={13} />
            <span className="flex-1 truncate text-(--text-2)">{entry.name}</span>
            <button type="button" className={`${buttonClass("quiet")} h-6 px-2 text-xs`} onClick={() => void act("queue.remove", { key: entry.key })}>
              Remove
            </button>
          </div>
        ))}
        {queue.entries.length > 12 ? <span className="text-xs text-(--text-3)">{`+${queue.entries.length - 12} more`}</span> : null}
        <div className="flex flex-wrap gap-2">
          <button type="button" className={buttonClass(queue.open ? "control" : "primary")} onClick={() => void act(queue.open ? "queue.close" : "queue.open")}>
            {queue.open ? "Close queue" : "Open queue"}
          </button>
          <button type="button" className={buttonClass("control")} disabled={queue.entries.length === 0} onClick={() => void act("queue.next")}>
            Next
          </button>
          <button type="button" className={buttonClass("quiet")} onClick={() => void act("queue.clear")}>
            Clear
          </button>
        </div>
      </div>
    </Section>
  );
}

function ChatPanel({ tools, chat, act }: { tools: PublicLiveTools; chat: ChatLine[]; act: Act }) {
  return (
    <Section title="Chat highlight" aside={<Muted>Pin any message on stream</Muted>}>
      <div className="flex flex-col gap-3 border-t border-(--line) pt-4">
        {tools.highlight ? (
          <div className="flex items-center gap-2 rounded-(--r) bg-(--accent-soft) px-2.5 py-2 text-[13px]">
            <PlatformSlot platform={tools.highlight.platform} size={13} />
            <span className="min-w-0 flex-1 truncate text-(--text)">
              <span className="font-semibold">{tools.highlight.name}</span> {tools.highlight.message}
            </span>
            <button type="button" className={buttonClass("control")} onClick={() => void act("highlight.clear")}>
              Unpin
            </button>
          </div>
        ) : null}
        <div className="flex max-h-90 flex-col overflow-y-auto">
          {chat.length === 0 ? <Muted>Chat messages from the last 24 hours show up here.</Muted> : null}
          {[...chat].reverse().map((line) => (
            <div key={line.id} className="group flex min-h-9 items-center gap-2 border-t border-(--line) text-[13px] first:border-t-0">
              <PlatformSlot platform={line.platform} size={12} />
              <span className="min-w-0 flex-1 truncate text-(--text-2)">
                <span className="font-medium text-(--text)">{line.name}</span> {line.message}
              </span>
              <button type="button" className={`${buttonClass("quiet")} h-6 px-2 text-xs opacity-0 group-hover:opacity-100`} onClick={() => void act("highlight.pin", { eventId: line.id })}>
                Pin
              </button>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

function WheelPanel({ tools, act }: { tools: PublicLiveTools; act: Act }) {
  const [wheels, setWheels] = useState<{ id: string; name: string; segments: string[] }[] | null>(null);
  useEffect(() => {
    const load = setTimeout(async () => {
      const response = await fetch("/api/overlays").catch(() => null);
      const json = (await response?.json().catch(() => null)) as { overlays?: { id: string; name: string; type: string; settings: { segments?: string } }[] } | null;
      setWheels((json?.overlays ?? []).filter((overlay) => overlay.type === "wheel").map((overlay) => ({ id: overlay.id, name: overlay.name, segments: wheelSegments(overlay.settings.segments ?? "") })));
    }, 0);
    return () => clearTimeout(load);
  }, []);
  const spin = tools.wheel;
  return (
    <Section title="Spin wheel" aside={<Muted>{wheels?.length ? `${wheels.length} wheel overlay${wheels.length > 1 ? "s" : ""}` : "Add a Spin wheel overlay"}</Muted>}>
      <div className="flex flex-col gap-3 border-t border-(--line) pt-4">
        {spin && wheels?.length ? (
          <div className="flex flex-col gap-1">
            {wheels.map((wheel) => (
              <span key={wheel.id} className="text-[13px] text-(--text-2)">
                {wheels.length > 1 ? `${wheel.name}: ` : "Landed on: "}
                <span className="font-semibold text-(--text)">{wheel.segments[wheelResult(spin.seed, wheel.segments.length)] ?? "–"}</span>
              </span>
            ))}
          </div>
        ) : null}
        <div className="flex gap-2">
          <button type="button" className={buttonClass("primary")} disabled={!wheels?.length} onClick={() => void act("wheel.spin")}>
            Spin the wheel
          </button>
          {!wheels?.length ? (
            <Link href="/dashboard/overlays" className={buttonClass("quiet")}>
              Create one
            </Link>
          ) : null}
        </div>
      </div>
    </Section>
  );
}
