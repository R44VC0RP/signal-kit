"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { OverlayRenderer } from "@/components/overlay/Overlays";
import type { PublicStats } from "@/lib/overlays/stats-core";
import type { SignalKitEvent } from "@/lib/events/types";
import { overlayTypeInfo, type AnySettings, type OverlayType } from "@/lib/overlays/settings";

export type StageBackground = "gameplay" | "chatting" | "transparent";

/** Where each overlay sits on a 1920×1080 stream in the preview (chat bottom left, list top right). */
const PLACEMENT: Record<OverlayType, CSSProperties> = {
  alerts: { left: 0, top: 0 },
  chat: { left: 48, bottom: 48 },
  events: { right: 48, top: 48 },
  goal: { left: 48, top: 48 },
  label: { left: 48, top: 48 },
  emotewall: { left: 0, top: 0 },
  ticker: { left: 0, bottom: 0 },
};

/**
 * A fake stream with the overlay rendered on top at true 1080p size, scaled to fit. Uses the
 * same renderer as the browser source, so what you see here is what OBS shows.
 */
export function PreviewStage({
  type,
  settings,
  events,
  stats,
  overlayId,
  background,
}: {
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
  const box: CSSProperties = { ...PLACEMENT[type], width: info.width, height: info.height };

  return (
    <div ref={frame} className="relative aspect-video w-full overflow-hidden rounded-[8px] border border-(--line) bg-black">
      <div className="absolute top-0 left-0 h-[1080px] w-[1920px] origin-top-left" style={{ transform: `scale(${scale})` }}>
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
          <OverlayRenderer type={type} settings={settings} events={events} stats={stats} overlayId={overlayId} />
        </div>
        {type !== "alerts" && type !== "emotewall" ? <div className="pointer-events-none absolute rounded-[6px] outline-2 outline-white/10 outline-dashed" style={box} /> : null}
      </div>
    </div>
  );
}
