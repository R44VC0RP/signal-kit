"use client";

import { useRouter } from "next/navigation";
import { useState, type CSSProperties } from "react";
import { buttonClass, Muted, Section } from "@/components/dashboard/ui";
import { fontStack, googleFontsUrl } from "@/lib/overlays/settings";
import { THEMES, type Theme } from "@/lib/overlays/themes";

const SHADOW: Record<string, string> = {
  outline: "0 0 1px #000, 0 0 2px #000, 0 0 3px #000",
  soft: "0 2px 3px rgb(0 0 0 / 60%), 0 6px 18px rgb(0 0 0 / 50%)",
  heavy: "2px 2px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000",
  none: "none",
};

const FONTS_URL = googleFontsUrl(THEMES.flatMap((theme) => [theme.look.font, theme.chat.font ?? theme.look.font])) ?? "";

/** Theme packs: a small sample of each, and one click restyles every overlay to match. */
export function ThemePacks({ overlayCount }: { overlayCount: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const apply = async (theme: Theme) => {
    if (!window.confirm(`Restyle all ${overlayCount} overlays with ${theme.name}? Your alert text, art, sounds and filters stay as they are.`)) {
      return;
    }
    setBusy(theme.id);
    const response = await fetch("/api/overlays/theme", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ theme: theme.id }) }).catch(() => null);
    setBusy(null);
    if (response?.ok) {
      setDone(theme.id);
      setTimeout(() => setDone(null), 2500);
      router.refresh();
    }
  };

  return (
    <Section title="Theme packs" aside={<Muted>Restyles every overlay at once, including ones open in OBS</Muted>}>
      <link rel="stylesheet" href={FONTS_URL} precedence="default" />
      <div className="grid grid-cols-3 gap-3 border-t border-(--line) pt-4">
        {THEMES.map((theme) => (
          <div key={theme.id} className="flex flex-col gap-3 rounded-[10px] border border-(--line) p-3">
            <ThemeSample theme={theme} />
            <div className="flex items-start gap-3">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[13px] font-semibold text-(--text)">{theme.name}</span>
                <span className="text-xs leading-[18px] text-(--text-3)">{theme.description}</span>
              </div>
              <button type="button" className={`${buttonClass("control")} shrink-0`} disabled={busy !== null || overlayCount === 0} onClick={() => void apply(theme)}>
                {busy === theme.id ? "Applying…" : done === theme.id ? "Applied" : "Apply"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

/** A miniature alert, chat line and goal bar in the theme's type and colours. */
export function ThemeSample({ theme }: { theme: Theme }) {
  const { look } = theme;
  const panel = look.panelOpacity > 0 ? `color-mix(in srgb, ${look.panelColor} ${Math.round(look.panelOpacity * 100)}%, transparent)` : "transparent";
  const shadow = look.textShadow === "glow" ? `0 0 1px #000, 0 0 6px ${look.accentColor}` : SHADOW[look.textShadow];
  const text: CSSProperties = { fontFamily: fontStack(look.font), fontWeight: look.fontWeight, color: look.textColor, textShadow: shadow };
  return (
    <div className="relative flex h-30 flex-col justify-between overflow-hidden rounded-[6px] bg-[linear-gradient(135deg,#3b4a5c,#1d2430_55%,#2a1f2e)] p-3">
      <div className="self-center px-2 py-1 text-center text-[15px] leading-tight" style={{ ...text, background: panel, borderRadius: look.radius / 2 }}>
        <span style={{ color: look.accentColor }}>mira</span> just subscribed!
      </div>
      <div className="flex items-end justify-between gap-3">
        <span className="truncate px-1.5 py-0.5 text-[11px]" style={{ ...text, fontFamily: fontStack(theme.chat.font ?? look.font), fontWeight: theme.chat.fontWeight ?? look.fontWeight, background: theme.chat.layout === "boxed" ? panel : "transparent", borderRadius: look.radius / 3 }}>
          <span style={{ color: look.accentColor }}>devon</span>: gg
        </span>
        <span className="relative h-2.5 w-20 shrink-0 overflow-hidden" style={{ background: theme.goal.barBackground, borderRadius: look.radius / 4 }}>
          <span className="absolute inset-y-0 left-0 w-3/5" style={{ background: theme.goal.barColor }} />
        </span>
      </div>
    </div>
  );
}
