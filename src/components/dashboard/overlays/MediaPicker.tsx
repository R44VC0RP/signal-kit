"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buttonClass } from "@/components/dashboard/ui";
import { ART_CATEGORIES, LIBRARY_ART, LIBRARY_SOUNDS, SOUND_CATEGORIES } from "@/lib/library";
import { ALERT_KIND_LABEL, defaultArt, type AlertKind } from "@/lib/overlays/settings";

/** Browse Signal Kit's art or sound library and pick one for an alert. */
export function MediaPicker({ mode, kind, current, onPick, onClose }: { mode: "art" | "sound"; kind: AlertKind; current: string; onPick: (value: string) => void; onClose: () => void }) {
  const [tab, setTab] = useState("suggested");
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      audio.current?.pause();
    };
  }, [onClose]);

  const categories = mode === "art" ? ART_CATEGORIES : SOUND_CATEGORIES;
  const items = useMemo(() => {
    const all = mode === "art" ? LIBRARY_ART : LIBRARY_SOUNDS;
    return tab === "suggested" ? all.filter((item) => item.suggestedFor.includes(kind)) : all.filter((item) => item.category === tab);
  }, [mode, tab, kind]);

  const play = (file: string) => {
    audio.current?.pause();
    if (playing === file) {
      setPlaying(null);
      return;
    }
    const sound = new Audio(file);
    sound.onended = () => setPlaying(null);
    audio.current = sound;
    setPlaying(file);
    void sound.play().catch(() => setPlaying(null));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-8" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={mode === "art" ? "Art library" : "Sound library"}
        className="sk-app flex max-h-full w-full max-w-200 flex-col overflow-hidden rounded-[10px] border border-(--line) bg-(--surface-panel)"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-4 border-b border-(--line) px-5 py-4">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-[15px] font-semibold text-(--text)">{mode === "art" ? "Art library" : "Sound library"}</h2>
            <span className="text-xs text-(--text-3)">For {ALERT_KIND_LABEL[kind].toLowerCase()} alerts</span>
          </div>
          <button type="button" aria-label="Close" className={`${buttonClass("quiet")} size-8 px-0`} onClick={onClose}>
            ✕
          </button>
        </header>
        <div className="flex flex-wrap gap-1 border-b border-(--line) px-4 pt-2">
          {[{ id: "suggested", name: "Suggested" }, ...categories].map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => setTab(category.id)}
              className={`-mb-px border-b-2 px-2.5 pb-2 text-[13px] ${category.id === tab ? "border-(--accent) font-medium text-(--text)" : "border-transparent text-(--text-3) hover:text-(--text)"}`}
            >
              {category.name}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {mode === "art" ? (
            <div className="grid grid-cols-6 gap-2">
              {(items as typeof LIBRARY_ART).map((item) => {
                const value = item.url.startsWith("/alerts/art/") ? "" : item.url;
                const selected = current === value || (current === "" && item.url === defaultArt(kind));
                return (
                  <button
                    key={item.id}
                    type="button"
                    title={`${item.name} · ${item.license}`}
                    onClick={() => onPick(value)}
                    className={`group flex flex-col items-center gap-1.5 rounded-[8px] border p-2 transition-colors ${selected ? "border-(--accent) bg-(--accent-soft)" : "border-transparent hover:bg-(--hover)"}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.url} alt="" loading="lazy" className="size-20 object-contain" />
                    <span className="w-full truncate text-center text-[11px] text-(--text-3) group-hover:text-(--text-2)">{item.name}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col">
              {(items as typeof LIBRARY_SOUNDS).map((item) => (
                <div key={item.id} className={`flex min-h-12 items-center gap-3 border-t border-(--line) px-1 first:border-t-0 ${current === item.file ? "bg-(--accent-soft)" : ""}`}>
                  <button type="button" aria-label={`Play ${item.name}`} className={`${buttonClass("control")} w-8 px-0`} onClick={() => play(item.file)}>
                    {playing === item.file ? "■" : "▶"}
                  </button>
                  <span className="flex-1 text-[13px] text-(--text)">{item.name}</span>
                  <span className="sk-mono w-14 text-right text-xs text-(--text-3)">{item.durationSec.toFixed(1)}s</span>
                  <button type="button" className={buttonClass(current === item.file ? "primary" : "quiet")} onClick={() => onPick(item.file)}>
                    {current === item.file ? "Using" : "Use"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <footer className="border-t border-(--line) px-5 py-3 text-[11px] leading-4 text-(--text-3)">
          {mode === "art"
            ? "Animated emoji: Noto Emoji animations by Google, CC BY 4.0. 3D emoji: Fluent Emoji by Microsoft, MIT. Signal Kit icons are ours."
            : "All sounds are CC0 (public domain): Kenney, Juhani Junkala and JaggedStone. Free to use on stream and in VODs."}
        </footer>
      </div>
    </div>
  );
}
