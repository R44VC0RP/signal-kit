"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { OverlayRenderer } from "@/components/overlay/Overlays";
import type { PublicLiveTools } from "@/lib/live/types";
import type { PublicStats } from "@/lib/overlays/stats-core";
import type { CreditsData, LiveSnapshot } from "@/lib/streams/summary";
import type { SignalKitEvent } from "@/lib/events/types";
import { OVERLAY_PLACEMENT, overlayTypeInfo, type AnySettings, type OverlayType } from "@/lib/overlays/settings";

export type StageBackground = "gameplay" | "chatting" | "transparent";

/**
 * A fake stream with the overlay rendered on top at true 1080p size, scaled to fit. Uses the
 * same renderer as the browser source, so what you see here is what OBS shows, except YouTube's
 * icon: scaled down it would fall below YouTube's 20px minimum, so a scaled stage leaves it out
 * (sko-scaled-preview in overlay.css). The browser source at 100% shows it.
 */
export function PreviewStage({
  type,
  settings,
  events,
  stats,
  overlayId,
  background,
  tools,
  stream,
  credits,
}: {
  tools?: PublicLiveTools | null;
  stream?: LiveSnapshot | null;
  credits?: CreditsData | null;
  type: OverlayType;
  settings: AnySettings;
  events: SignalKitEvent[];
  stats: PublicStats | null;
  overlayId: string;
  background: StageBackground;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  useEffect(() => {
    const element = frame.current;
    if (!element) {
      return;
    }
    const observer = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / 1920));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const info = overlayTypeInfo(type);
  const box: CSSProperties = { left: OVERLAY_PLACEMENT[type].x, top: OVERLAY_PLACEMENT[type].y, width: info.width, height: info.height };

  return (
    <div ref={frame} className="relative aspect-video w-full overflow-hidden rounded-[8px] border border-(--line) bg-black">
      <div className={`absolute top-0 left-0 h-[1080px] w-[1920px] origin-top-left ${scale < 1 ? "sko-scaled-preview" : ""}`} style={{ transform: `scale(${scale})` }}>
        {background === "gameplay" ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/preview/stream-sample.jpg" alt="" className="absolute inset-0 size-full object-cover" draggable={false} />
            <div className="absolute right-12 bottom-12 flex h-[252px] w-[448px] items-end rounded-[16px] border-2 border-white/15 bg-black/40 p-5">
              <span className="font-mono text-[22px] tracking-wider text-white/55 uppercase">Camera</span>
            </div>
          </>
        ) : background === "chatting" ? (
          <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_60%_40%,#3a3550_0%,#1b1a24_55%,#0d0d12_100%)]">
            <div className="absolute top-[150px] right-[220px] flex h-[720px] w-[1000px] items-end rounded-[28px] border-2 border-white/12 bg-[linear-gradient(160deg,#4a4560,#25232f)] p-8">
              <span className="font-mono text-[28px] tracking-wider text-white/55 uppercase">Camera</span>
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 bg-[repeating-conic-gradient(#202020_0%_25%,#2b2b2b_0%_50%)] bg-[length:48px_48px]" />
        )}
        <div className="absolute" style={box}>
          <OverlayRenderer type={type} settings={settings} events={events} stats={stats} overlayId={overlayId} tools={tools} stream={stream} credits={credits} preview />
        </div>
        {type !== "alerts" && type !== "emotewall" && type !== "credits" ? <div className="pointer-events-none absolute rounded-[6px] outline-2 outline-white/10 outline-dashed" style={box} /> : null}
      </div>
    </div>
  );
}
