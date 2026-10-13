"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { OverlayRenderer, type OverlayEvent } from "@/components/overlay/Overlays";
import { sampleEvent, sampleStream, type SampleKind } from "@/lib/overlays/samples";
import { defaultSettings, type AlertSettings, type ChatSettings, type GoalSettings, type OverlayType, type ViewersSettings } from "@/lib/overlays/settings";
import { applyTheme, THEMES } from "@/lib/overlays/themes";
import type { LiveSnapshot } from "@/lib/streams/summary";

export type DemoScene = { id: string; game: string; image: string; imageSmall: string; video?: string; author?: string; license?: string; licenseUrl?: string; sourceUrl?: string };

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
export function HomeDemo({ scenes, fallback }: { scenes: DemoScene[]; fallback: DemoScene }) {
  const all = scenes.length ? scenes : [fallback];
  const [themeId, setThemeId] = useState("classic");
  const [sceneId, setSceneId] = useState(all[0].id);
  const scene = all.find((item) => item.id === sceneId) ?? all[0];
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
    return () => clearInterval(timer);
  }, [visible]);

  return (
    <div className="flex flex-col gap-4">
      <div ref={frame} className="relative aspect-video w-full overflow-hidden rounded-xl border border-(--line) bg-black" aria-label="Live demo of Signal Kit overlays on a game stream">
        <div className="absolute top-0 left-0 h-[1080px] w-[1920px] origin-top-left" style={{ transform: `scale(${scale})` }}>
          {scene.video ? (
            <video key={scene.id} className="absolute inset-0 size-full object-cover" src={scene.video} poster={scene.image} autoPlay muted loop playsInline />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={scene.id} src={scene.image} alt="" className="absolute inset-0 size-full object-cover" draggable={false} />
          )}
          {BOXES.map(({ type, style }) => (
            <div key={type} className="absolute" style={style}>
              <OverlayRenderer type={type} settings={settings[type as keyof typeof settings]} events={events} stream={stream} overlayId="home-demo" />
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Theme">
          <span className="mr-1.5 text-xs text-(--text-3)">Try a theme</span>
          {THEMES.map((theme) => (
            <button
              key={theme.id}
              type="button"
              role="radio"
              aria-checked={theme.id === themeId}
              onClick={() => setThemeId(theme.id)}
              className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors ${
                theme.id === themeId ? "border-(--accent) bg-(--accent-soft) text-(--text)" : "border-(--line) text-(--text-2) hover:border-(--line-strong) hover:text-(--text)"
              }`}
            >
              <span className="size-2 rounded-full" style={{ background: theme.look.accentColor }} />
              {theme.name}
            </button>
          ))}
        </div>
        {all.length > 1 ? (
          <div className="flex shrink-0 items-center gap-1.5" role="radiogroup" aria-label="Game">
            {all.map((item) => (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={item.id === scene.id}
                title={item.game}
                onClick={() => setSceneId(item.id)}
                className={`h-8 w-14 overflow-hidden rounded-[5px] border-2 transition-colors ${item.id === scene.id ? "border-(--accent)" : "border-transparent opacity-70 hover:opacity-100"}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.imageSmall} alt={item.game} className="size-full object-cover" />
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {scene.author ? (
        <p className="text-[11px] text-(--text-3)">
          Gameplay:{" "}
          <a href={scene.sourceUrl} className="underline-offset-2 hover:text-(--text-2) hover:underline">
            {scene.game}
          </a>{" "}
          by {scene.author},{" "}
          <a href={scene.licenseUrl} className="underline-offset-2 hover:text-(--text-2) hover:underline">
            {scene.license}
          </a>
          . Overlays are Signal Kit, chat and alerts are samples.{" "}
          <a href="/credits" className="underline-offset-2 hover:text-(--text-2) hover:underline">
            Credits
          </a>
        </p>
      ) : null}
    </div>
  );
}
