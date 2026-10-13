"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { OverlayRenderer, type OverlayEvent } from "@/components/overlay/Overlays";
import { sampleEvent, sampleStream, type SampleKind } from "@/lib/overlays/samples";
import { defaultSettings, type AlertSettings, type ChatSettings, type GoalSettings, type OverlayType, type ViewersSettings } from "@/lib/overlays/settings";
import { applyTheme, THEMES } from "@/lib/overlays/themes";
import type { LiveSnapshot } from "@/lib/streams/summary";

export type DemoScene = { image: string; video?: string };

/** Where each overlay sits on the 1920×1080 demo stream. */
const BOXES: { type: OverlayType; style: CSSProperties }[] = [
  { type: "goal", style: { left: 48, top: 40, width: 560, height: 150 } },
  { type: "viewers", style: { left: 1452, top: 40, width: 420, height: 90 } },
  { type: "chat", style: { left: 40, top: 500, width: 470, height: 540 } },
  { type: "alerts", style: { left: 0, top: 0, width: 1920, height: 1080 } },
];

const ALERT_CYCLE: SampleKind[] = ["subscription", "cheer", "follow", "tip", "raid", "subscription.gift", "follow"];

function demoSettings(themeId: string) {
  const theme = THEMES.find((item) => item.id === themeId) ?? THEMES[0];
  const alerts = applyTheme("alerts", defaultSettings("alerts"), theme) as AlertSettings;
  const chat = applyTheme("chat", defaultSettings("chat"), theme) as ChatSettings;
  const goal = applyTheme("goal", defaultSettings("goal"), theme) as GoalSettings;
  const viewers = applyTheme("viewers", defaultSettings("viewers"), theme) as ViewersSettings;
  return {
    // Quick alerts and no sound: it's a demo on a web page.
    alerts: { ...alerts, durationSec: 4.5, gapSec: 0.8, sound: false, titleSize: 58, imageSize: 260 },
    chat: { ...chat, maxMessages: 10, showTips: true, showSubs: true },
    goal: { ...goal, title: "Follower goal", target: 50, startValue: 37 },
    viewers: { ...viewers, mode: "split" as const, label: "", fontSize: 30 },
  };
}

/**
 * The homepage's live demo: the same overlay renderer streamers put in OBS, on a gameplay
 * frame, with a scripted mix of Twitch, YouTube and X chat and alerts. Pauses off-screen.
 */
export function HomeDemo({ scene }: { scene: DemoScene }) {
  const [themeIndex, setThemeIndex] = useState(0);
  const themeId = THEMES[themeIndex % THEMES.length].id;
  const settings = useMemo(() => demoSettings(themeId), [themeId]);
  const [events, setEvents] = useState<OverlayEvent[]>([]);
  const [stream, setStream] = useState<LiveSnapshot | null>(null);
  const frame = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const element = frame.current;
    if (!element) {
      return;
    }
    const resize = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / 1920));
    const seen = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.1 });
    resize.observe(element);
    seen.observe(element);
    return () => {
      resize.disconnect();
      seen.disconnect();
    };
  }, []);

  // Seeded in the browser only (sample events use random ids and times).
  useEffect(() => {
    const start = setTimeout(() => {
      setEvents([1, 2, 3, 4, 5, 6].map((seed) => ({ ...sampleEvent("chat.message", seed), seenAt: Date.now() })));
      setStream(sampleStream());
    }, 0);
    return () => clearTimeout(start);
  }, []);

  useEffect(() => {
    if (!visible) {
      return;
    }
    let tick = 0;
    const timer = setInterval(() => {
      tick += 1;
      const kind: SampleKind = tick % 4 === 0 ? ALERT_CYCLE[(tick / 4) % ALERT_CYCLE.length] : "chat.message";
      setEvents((current) => [...current, { ...sampleEvent(kind), seenAt: Date.now() }].slice(-60));
      if (tick % 6 === 0) {
        setStream((current) => (current ? { ...current, viewers: { twitch: 120 + Math.round(Math.random() * 30), youtube: 38 + Math.round(Math.random() * 10) } } : current));
      }
    }, 1500);
    // A different theme every few seconds, so visitors see the looks without clicking.
    const themes = setInterval(() => setThemeIndex((index) => index + 1), 7000);
    return () => {
      clearInterval(timer);
      clearInterval(themes);
    };
  }, [visible]);

  return (
    <div ref={frame} className="relative aspect-video w-full overflow-hidden rounded-xl border border-(--line) bg-black" aria-label="Live demo of Signal Kit overlays on a game stream">
      <div className="absolute top-0 left-0 h-[1080px] w-[1920px] origin-top-left" style={{ transform: `scale(${scale})` }}>
        {scene.video ? (
          <video className="absolute inset-0 size-full object-cover" src={scene.video} poster={scene.image} autoPlay muted loop playsInline />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={scene.image} alt="" className="absolute inset-0 size-full object-cover" draggable={false} />
        )}
        {BOXES.map(({ type, style }) => (
          <div key={type} className="absolute" style={style}>
            <OverlayRenderer type={type} settings={settings[type as keyof typeof settings]} events={events} stream={stream} overlayId="home-demo" />
          </div>
        ))}
      </div>
    </div>
  );
}
