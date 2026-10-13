"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonClass, Muted, Row, Section } from "@/components/dashboard/ui";
import { timeAgo } from "@/lib/format";
import { OVERLAY_TYPES, overlayTypeInfo, type OverlayType } from "@/lib/overlays/settings";
import type { OverlayView } from "@/lib/overlays/store";
import { LiveBadge } from "./OverlayEditor";
import { TypeIcon } from "./TypeIcon";

type Overlay = OverlayView & { live: boolean };

export function OverlaysList({ initial }: { initial: Overlay[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState<OverlayType | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const create = async (type: OverlayType) => {
    setCreating(type);
    setError(null);
    const response = await fetch("/api/overlays", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
    }).catch(() => null);
    if (!response?.ok) {
      setCreating(null);
      setError(((await response?.json().catch(() => null)) as { error?: string } | null)?.error ?? "Couldn't create the overlay.");
      return;
    }
    const { overlay } = (await response.json()) as { overlay: Overlay };
    router.push(`/studio/${overlay.id}`);
  };

  const addStarters = async () => {
    setCreating("alerts");
    setError(null);
    for (const type of ["alerts", "chat", "events"] as const) {
      const response = await fetch("/api/overlays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      }).catch(() => null);
      if (!response?.ok) {
        setError("Couldn't create all three overlays. Try again.");
        break;
      }
    }
    setCreating(null);
    router.refresh();
  };

  const copy = async (overlay: Overlay) => {
    await navigator.clipboard.writeText(overlay.url);
    setCopied(overlay.id);
    setTimeout(() => setCopied(null), 1600);
  };

  return (
    <>
      {initial.length > 0 ? (
        <Section title="Your overlays" aside={<Muted>{initial.length === 1 ? "1 overlay" : `${initial.length} overlays`}</Muted>}>
          {initial.map((overlay) => {
            const info = overlayTypeInfo(overlay.type);
            return (
              <Row key={overlay.id}>
                <TypeIcon type={overlay.type} />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <Link href={`/studio/${overlay.id}`} className="truncate text-[13px] font-medium text-(--text) hover:underline">
                    {overlay.name}
                  </Link>
                  <Muted>
                    {info.name} · {overlay.width} × {overlay.height}
                    {!overlay.live && overlay.lastSeenAt ? ` · last in OBS ${timeAgo(overlay.lastSeenAt)}` : ""}
                  </Muted>
                </div>
                <LiveBadge live={overlay.live} />
                <button type="button" className={buttonClass("quiet")} onClick={() => void copy(overlay)}>
                  {copied === overlay.id ? "Copied" : "Copy URL"}
                </button>
                <Link href={`/studio/${overlay.id}`} className={buttonClass("control")}>
                  Customize
                </Link>
              </Row>
            );
          })}
        </Section>
      ) : null}

      {initial.length === 0 ? (
        <div className="flex flex-col gap-3 border-t border-(--line) pt-12">
          <h2 className="sk-brand text-[22px] leading-7 font-semibold tracking-[-0.01em] text-(--text)">Put your stream on screen</h2>
          <p className="max-w-140 text-[13px] leading-5 text-(--text-3)">
            Start with the three overlays most streamers use. Each one is a link you paste into OBS once, and you can change every detail
            later.
          </p>
          <div className="flex gap-2 pt-3">
            <button type="button" className={buttonClass("primary")} disabled={creating !== null} onClick={() => void addStarters()}>
              {creating ? "Creating…" : "Add all three"}
            </button>
          </div>
        </div>
      ) : null}

      <Section title={initial.length > 0 ? "New overlay" : "Or start with one"}>
        <div className="grid gap-3 border-t border-(--line) pt-4 md:grid-cols-3 xl:grid-cols-4">
          {OVERLAY_TYPES.map((type) => (
            <button
              key={type.type}
              type="button"
              disabled={creating !== null}
              onClick={() => void create(type.type)}
              className="group flex flex-col gap-3 rounded-[10px] border border-(--line) p-4 text-left transition-colors hover:border-(--line-strong) hover:bg-(--hover) disabled:opacity-60"
            >
              <TypeIcon type={type.type} />
              <span className="flex flex-col gap-1">
                <span className="text-[13px] font-semibold text-(--text)">{creating === type.type ? "Creating…" : type.name}</span>
                <span className="text-xs leading-[18px] text-(--text-3)">{type.description}</span>
              </span>
              <span className="sk-mono mt-auto text-[11px] text-(--text-3)">
                {type.width} × {type.height}
              </span>
            </button>
          ))}
        </div>
        {error ? <p className="pt-3 text-xs text-(--danger-text)">{error}</p> : null}
      </Section>
      {initial.length > 0 ? (
        <p className="border-t border-(--line) pt-3 text-xs leading-[18px] text-(--text-3)">
          Overlay URLs are private. Anyone with one can see your alerts and chat, so reset it if it leaks.
        </p>
      ) : null}
    </>
  );
}
