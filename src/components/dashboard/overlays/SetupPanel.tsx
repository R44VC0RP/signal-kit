"use client";

import { useEffect, useState } from "react";
import { buttonClass } from "@/components/dashboard/ui";
import { fillGuide, SETUP_GUIDES } from "@/lib/overlays/guides";
import { OVERLAY_PLACEMENT } from "@/lib/overlays/settings";
import { ObsConnect } from "./ObsConnect";
import type { OverlayView } from "@/lib/overlays/store";

type Overlay = OverlayView & { live: boolean };

/** "Add to your streaming app": the URL, its size, a live connection check and per-app steps. */
export function SetupPanel({
  overlay,
  onClose,
  onReset,
  onTest,
}: {
  overlay: Overlay;
  onClose: () => void;
  onReset: (next: Overlay) => void;
  onTest: () => void;
}) {
  const [app, setApp] = useState(SETUP_GUIDES[0].id);
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [resetting, setResetting] = useState(false);
  const guide = SETUP_GUIDES.find((item) => item.id === app) ?? SETUP_GUIDES[0];

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const copy = async () => {
    await navigator.clipboard.writeText(overlay.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const reset = async () => {
    if (!confirm("Reset this overlay's URL? The current URL stops working right away, so you'll need to paste the new one into your streaming app.")) {
      return;
    }
    setResetting(true);
    const response = await fetch(`/api/overlays/${overlay.id}/reset-url`, { method: "POST" }).catch(() => null);
    setResetting(false);
    if (response?.ok) {
      onReset(((await response.json()) as { overlay: Overlay }).overlay);
    }
  };

  // The secret part of the URL stays hidden on screen (streamers often share their screen).
  const masked = overlay.url.replace(/(sko_.{4}).+$/, "$1••••••••••••••••");

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/55" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add to your streaming app"
        className="sk-app flex h-full w-full max-w-130 flex-col gap-7 overflow-y-auto border-l border-(--line) bg-(--surface-panel) px-7 py-7"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="sk-brand text-[22px] leading-7 font-semibold tracking-[-0.01em] text-(--text)">Add to your streaming app</h2>
            <p className="text-[13px] text-(--text-3)">Paste this URL as a browser source. Settings you change here update it instantly.</p>
          </div>
          <button type="button" aria-label="Close" className={`${buttonClass("quiet")} size-8 px-0`} onClick={onClose}>
            ✕
          </button>
        </header>

        <section className="flex flex-col gap-3">
          <span className="text-[13px] font-medium text-(--text)">OBS Studio</span>
          <ObsConnect sources={[{ name: `Signal Kit · ${overlay.name}`, url: overlay.url, width: overlay.width, height: overlay.height, ...OVERLAY_PLACEMENT[overlay.type] }]} />
        </section>

        <section className="flex flex-col gap-3">
          <span className="text-[13px] font-medium text-(--text)">Or paste the browser source URL</span>
          <div className="flex items-center gap-2 rounded-(--r) border border-(--line) bg-(--surface-inset) py-1.5 pr-1.5 pl-3">
            <code className="sk-mono min-w-0 flex-1 truncate text-xs text-(--text-2)">{revealed ? overlay.url : masked}</code>
            <button type="button" className={buttonClass("quiet")} onClick={() => setRevealed((value) => !value)}>
              {revealed ? "Hide" : "Show"}
            </button>
            <button type="button" className={buttonClass("primary")} onClick={() => void copy()}>
              {copied ? "Copied" : "Copy URL"}
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-(--text-3)">
            <span>
              Size: <span className="sk-mono text-(--text-2)">{overlay.width} × {overlay.height}</span>
            </span>
            <button type="button" className="text-(--text-3) underline-offset-2 hover:text-(--danger-text) hover:underline" disabled={resetting} onClick={() => void reset()}>
              {resetting ? "Resetting…" : "Reset URL"}
            </button>
          </div>
          <p className="text-xs leading-[18px] text-(--text-3)">Anyone with this URL sees your alerts and chat, so keep it private. If it leaks, reset it.</p>
        </section>

        <section className="flex items-center gap-3 rounded-(--r) border border-(--line) px-4 py-3.5">
          <span className={`size-2 shrink-0 rounded-full ${overlay.live ? "bg-(--onair)" : "animate-pulse bg-[#555555]"}`} />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-[13px] font-medium text-(--text)">{overlay.live ? "Connected in your streaming app" : "Waiting for your streaming app…"}</span>
            <span className="text-xs text-(--text-3)">{overlay.live ? "Send a test to check how it looks on stream." : "This turns green as soon as the browser source loads."}</span>
          </div>
          <button type="button" className={buttonClass("control")} disabled={!overlay.live} onClick={onTest}>
            Send test
          </button>
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-1 border-b border-(--line)">
            {SETUP_GUIDES.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setApp(item.id)}
                className={`-mb-px border-b-2 px-2.5 pb-2.5 text-[13px] ${item.id === app ? "border-(--accent) font-medium text-(--text)" : "border-transparent text-(--text-3) hover:text-(--text)"}`}
              >
                {item.app}
              </button>
            ))}
          </div>
          <ol className="flex flex-col gap-3">
            {guide.steps.map((step, index) => (
              <li key={step} className="flex gap-3 text-[13px] leading-5 text-(--text-2)">
                <span className="sk-mono flex size-5 shrink-0 items-center justify-center rounded-full bg-(--control) text-[11px] text-(--text)">{index + 1}</span>
                <span>{fillGuide(step, overlay)}</span>
              </li>
            ))}
          </ol>
          {guide.tip ? <p className="border-t border-(--line) pt-3 text-xs leading-[18px] text-(--text-3)">Tip: {guide.tip}</p> : null}
        </section>
      </div>
    </div>
  );
}
