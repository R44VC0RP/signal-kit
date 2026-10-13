"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { OverlayRenderer, type OverlayEvent } from "@/components/overlay/Overlays";
import { sampleEvent, sampleLiveTools, sampleStream, type SampleKind } from "@/lib/overlays/samples";
import { defaultSettings, type AnySettings, type OverlayType } from "@/lib/overlays/settings";
import type { LiveSnapshot } from "@/lib/streams/summary";

/** The homepage's overlays: the Classic defaults, kept calm (no sound, short alerts). */
function useCalmSettings() {
  return useMemo(() => {
    const alerts = defaultSettings("alerts");
    return {
      alerts: { ...alerts, durationSec: 5, gapSec: 1, sound: false, titleSize: 56, imageSize: 240 },
      chat: { ...defaultSettings("chat"), maxMessages: 9, fontSize: 21, showTips: false, showSubs: false },
      goal: { ...defaultSettings("goal"), title: "Follower goal", target: 50, startValue: 37 },
      viewers: { ...defaultSettings("viewers"), mode: "split" as const, label: "", fontSize: 26, align: "left" as const },
      poll: { ...defaultSettings("poll"), fontSize: 22 },
      highlight: { ...defaultSettings("highlight"), fontSize: 26 },
    } satisfies Partial<Record<OverlayType, AnySettings>>;
  }, []);
}

/** A 1920×1080 stage scaled to its container's width. */
function Stage({ children, label }: { children: ReactNode; label: string }) {
  const frame = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  useEffect(() => {
    const element = frame.current;
    if (!element) {
      return;
    }
    const resize = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / 1920));
    resize.observe(element);
    return () => resize.disconnect();
  }, []);
  return (
    <div ref={frame} className="relative aspect-video w-full overflow-hidden rounded-xl border border-(--line) bg-black" aria-label={label}>
      <div className="absolute top-0 left-0 h-[1080px] w-[1920px] origin-top-left" style={{ transform: `scale(${scale})` }}>
        {children}
      </div>
    </div>
  );
}

function Box({ style, children }: { style: CSSProperties; children: ReactNode }) {
  return (
    <div className="absolute" style={style}>
      {children}
    </div>
  );
}

const TABS: { id: string; label: string; text: string; event?: SampleKind }[] = [
  { id: "alerts", label: "Alerts", text: "Art, sound and animation for follows, subs, bits and tips.", event: "subscription" },
  { id: "chat", label: "Chat", text: "Twitch, YouTube and X in one box, with emotes and badges." },
  { id: "goals", label: "Goals", text: "Progress bars, labels, a ticker and end-of-stream credits.", event: "follow" },
  { id: "live", label: "Live tools", text: "Polls, giveaways and a viewer queue anyone can join from chat." },
  { id: "stats", label: "Stats", text: "A report for every stream, posted to your Discord." },
];

const TAB_MS = 7000;

/**
 * The hero: a game stream with Signal Kit's default overlays (chat, a goal, viewer count, an
 * occasional alert), and a row of tabs that slowly steps through what's included.
 */
export function HomeShowcase({ video, poster, fallbackVideo }: { video: string; poster: string; fallbackVideo?: string }) {
  const settings = useCalmSettings();
  const [events, setEvents] = useState<OverlayEvent[]>([]);
  const [stream, setStream] = useState<LiveSnapshot | null>(null);
  const [tab, setTab] = useState(0);
  const [pinned, setPinned] = useState(false);
  const tools = useMemo(() => ({ ...sampleLiveTools(), highlight: null }), []);
  const root = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const element = root.current;
    if (!element) {
      return;
    }
    const seen = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.1 });
    seen.observe(element);
    return () => seen.disconnect();
  }, []);

  // Seeded in the browser only (sample events use random ids and times).
  useEffect(() => {
    const start = setTimeout(() => {
      setEvents([1, 2, 3, 4, 5].map((seed) => ({ ...sampleEvent("chat.message", seed), seenAt: Date.now() })));
      setStream(sampleStream());
    }, 0);
    return () => clearTimeout(start);
  }, []);

  // A relaxed chat pace, and the tabs stepping along unless someone picked one.
  useEffect(() => {
    if (!visible) {
      return;
    }
    const chat = setInterval(() => setEvents((current) => [...current, { ...sampleEvent("chat.message"), seenAt: Date.now() }].slice(-40)), 2600);
    const tabs = pinned ? undefined : setInterval(() => setTab((index) => (index + 1) % TABS.length), TAB_MS);
    return () => {
      clearInterval(chat);
      clearInterval(tabs);
    };
  }, [visible, pinned]);

  // The Alerts and Goals tabs each show one event (an alert, and the goal moving).
  useEffect(() => {
    const kind = TABS[tab].event;
    if (!kind || !visible) {
      return;
    }
    const fire = setTimeout(() => setEvents((current) => [...current, { ...sampleEvent(kind), seenAt: Date.now() }].slice(-40)), 400);
    return () => clearTimeout(fire);
  }, [tab, visible]);

  const active = TABS[tab].id;
  return (
    <div ref={root} className="flex flex-col">
      <Stage label="Signal Kit overlays on a game stream">
        <video className="absolute inset-0 size-full object-cover" poster={poster} autoPlay muted loop playsInline>
          <source src={video} type="video/webm" />
          {fallbackVideo ? <source src={fallbackVideo} type="video/mp4" /> : null}
        </video>
        <Box style={{ left: 40, top: 32, width: 520, height: 80 }}>
          <OverlayRenderer type="viewers" settings={settings.viewers} events={[]} stream={stream} />
        </Box>
        <Box style={{ left: 48, top: 900, width: 560, height: 150 }}>
          <OverlayRenderer type="goal" settings={settings.goal} events={events} overlayId="home" />
        </Box>
        <Box style={{ left: 1390, top: 380, width: 490, height: 660 }}>
          <OverlayRenderer type="chat" settings={settings.chat} events={events} />
        </Box>
        {active === "live" ? (
          <Box style={{ left: 1240, top: 40, width: 640, height: 330 }}>
            <OverlayRenderer type="poll" settings={settings.poll} events={[]} tools={tools} />
          </Box>
        ) : null}
        <Box style={{ left: 0, top: 0, width: 1920, height: 1080 }}>
          <OverlayRenderer type="alerts" settings={settings.alerts} events={events} />
        </Box>
      </Stage>

      <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-5" role="tablist" aria-label="What's included">
        {TABS.map((item, index) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={index === tab}
            onClick={() => {
              setTab(index);
              setPinned(true);
            }}
            className={`flex flex-col gap-1.5 border-t-2 pt-4 pb-2 text-left transition-colors ${index === tab ? "border-(--accent)" : "border-(--line) hover:border-(--line-strong)"}`}
          >
            <span className={`text-[15px] font-medium ${index === tab ? "text-(--text)" : "text-(--text-2)"}`}>{item.label}</span>
            <span className="text-[13px] leading-5 text-(--text-3)">{item.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** "Let chat play along": a chat poll and a pinned message on the same stream. */
export function PollScene({ poster }: { poster: string }) {
  const settings = useCalmSettings();
  const tools = useMemo(() => sampleLiveTools(), []);
  return (
    <Stage label="A chat poll and a pinned chat message on stream">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={poster} alt="" className="absolute inset-0 size-full object-cover" />
      <Box style={{ left: 80, top: 80, width: 900, height: 520 }}>
        <OverlayRenderer type="poll" settings={{ ...settings.poll, fontSize: 30 }} events={[]} tools={tools} />
      </Box>
      <Box style={{ left: 80, top: 760, width: 1100, height: 240 }}>
        <OverlayRenderer type="highlight" settings={{ ...settings.highlight, fontSize: 32 }} events={[]} tools={tools} />
      </Box>
    </Stage>
  );
}
