"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ObsConnect } from "@/components/dashboard/overlays/ObsConnect";
import { ThemeSample } from "@/components/dashboard/overlays/ThemePacks";
import { buttonClass, Muted, Section } from "@/components/dashboard/ui";
import { ALERT_PACKS, ART_CATEGORIES, LIBRARY_ART, LIBRARY_SOUNDS, SOUND_CATEGORIES } from "@/lib/library";
import { ALERT_KINDS, defaultArt, googleFontsUrl, OVERLAY_PLACEMENT, OVERLAY_TYPES, type OverlayType } from "@/lib/overlays/settings";
import type { OverlayView } from "@/lib/overlays/store";
import { THEMES } from "@/lib/overlays/themes";

const FONTS_URL = googleFontsUrl(THEMES.flatMap((theme) => [theme.look.font, theme.chat.font ?? theme.look.font])) ?? "";
const DEFAULT_TYPES: OverlayType[] = ["alerts", "chat", "events", "goal"];

/** Pick a theme and an alert pack, choose overlays, and set it all up (in OBS too) in one go. */
export function Library({ overlayTypes }: { overlayTypes: OverlayType[] }) {
  const router = useRouter();
  const [theme, setTheme] = useState("classic");
  const [pack, setPack] = useState("animated-emoji");
  const [types, setTypes] = useState<OverlayType[]>(DEFAULT_TYPES);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState<OverlayView[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setup = async () => {
    setBusy(true);
    setError(null);
    const response = await fetch("/api/library/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ theme, pack, types }) }).catch(() => null);
    setBusy(false);
    if (!response?.ok) {
      setError("Couldn't set up your overlays. Try again.");
      return;
    }
    setReady(((await response.json()) as { overlays: OverlayView[] }).overlays);
    router.refresh();
  };

  return (
    <>
      <link rel="stylesheet" href={FONTS_URL} precedence="default" />
      <Section title="Set up your stream in one click" aside={<Muted>Theme, alert art and sounds, then straight into OBS</Muted>}>
        <div className="flex flex-col gap-6 border-t border-(--line) pt-5">
          <Step number={1} title="Pick a look">
            <div className="grid grid-cols-3 gap-2.5">
              {THEMES.map((item) => (
                <button key={item.id} type="button" onClick={() => setTheme(item.id)} className={`flex flex-col gap-2 rounded-[10px] border p-2 text-left ${item.id === theme ? "border-(--accent) bg-(--accent-soft)" : "border-(--line) hover:border-(--line-strong)"}`}>
                  <ThemeSample theme={item} />
                  <span className="px-1 text-[13px] font-medium text-(--text)">{item.name}</span>
                </button>
              ))}
            </div>
          </Step>
          <Step number={2} title="Pick alert art and sounds">
            <div className="grid grid-cols-2 gap-2.5">
              {ALERT_PACKS.map((item) => (
                <button key={item.id} type="button" onClick={() => setPack(item.id)} className={`flex flex-col gap-2.5 rounded-[10px] border p-3 text-left ${item.id === pack ? "border-(--accent) bg-(--accent-soft)" : "border-(--line) hover:border-(--line-strong)"}`}>
                  <span className="flex gap-1.5">
                    {ALERT_KINDS.map((kind) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={kind} src={item.media[kind].image || defaultArt(kind)} alt="" loading="lazy" className="size-9 object-contain" />
                    ))}
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <span className="text-[13px] font-medium text-(--text)">{item.name}</span>
                    <span className="text-xs text-(--text-3)">{item.description}</span>
                  </span>
                </button>
              ))}
            </div>
          </Step>
          <Step number={3} title="Choose overlays">
            <div className="flex flex-wrap gap-2">
              {OVERLAY_TYPES.map((info) => {
                const on = types.includes(info.type);
                const have = overlayTypes.includes(info.type);
                return (
                  <button
                    key={info.type}
                    type="button"
                    onClick={() => setTypes(on ? types.filter((type) => type !== info.type) : [...types, info.type])}
                    className={`inline-flex h-8 items-center gap-2 rounded-full border px-3 text-[13px] ${on ? "border-(--accent) bg-(--accent-soft) text-(--text)" : "border-(--line) text-(--text-3) hover:text-(--text)"}`}
                  >
                    {on ? "✓ " : ""}
                    {info.name}
                    {have ? <span className="text-[11px] text-(--text-3)">have it</span> : null}
                  </button>
                );
              })}
            </div>
            <span className="text-xs text-(--text-3)">Overlays you already have keep their text, events and settings; they just get the new look.</span>
          </Step>
          <div className="flex flex-col gap-3 border-t border-(--line) pt-5">
            {ready ? (
              <ObsConnect
                label={`Add ${ready.length} overlays to OBS`}
                sources={ready.map((overlay) => ({ name: `Signal Kit · ${overlay.name}`, url: overlay.url, width: overlay.width, height: overlay.height, ...OVERLAY_PLACEMENT[overlay.type] }))}
              />
            ) : (
              <button type="button" className={`${buttonClass("primary", "lg")} self-start`} disabled={busy} onClick={() => void setup()}>
                {busy ? "Setting up…" : "Set up my overlays"}
              </button>
            )}
            {ready ? <span className="text-xs text-(--text-3)">Your overlays are styled. Add them to OBS, or customize each one from Overlays.</span> : null}
            {error ? <span className="text-xs text-(--danger-text)">{error}</span> : null}
          </div>
        </div>
      </Section>

      <ArtBrowser />
      <SoundBrowser />

      <Section title="Credits">
        <div className="flex flex-col gap-1.5 border-t border-(--line) pt-4 text-xs leading-[18px] text-(--text-3)">
          <p>
            Animated emoji: <a className="underline hover:text-(--text)" href="https://googlefonts.github.io/noto-emoji-animation/">Noto Emoji animations</a> by Google, CC BY 4.0.
          </p>
          <p>
            3D emoji: <a className="underline hover:text-(--text)" href="https://github.com/microsoft/fluentui-emoji">Fluent Emoji</a> by Microsoft, MIT license.
          </p>
          <p>
            Sounds: <a className="underline hover:text-(--text)" href="https://kenney.nl/assets">Kenney</a>, Juhani Junkala and JaggedStone (OpenGameArt), all CC0. Fonts: Google Fonts (SIL OFL).
          </p>
        </div>
      </Section>
    </>
  );
}

function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <span className="sk-mono flex size-6 shrink-0 items-center justify-center rounded-full bg-(--control) text-xs text-(--text)">{number}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <span className="pt-0.5 text-[13px] font-semibold text-(--text)">{title}</span>
        {children}
      </div>
    </div>
  );
}

function ArtBrowser() {
  const [category, setCategory] = useState("celebrate");
  const items = LIBRARY_ART.filter((item) => item.category === category);
  return (
    <Section title="Alert art" aside={<Muted>{`${LIBRARY_ART.length} pieces · pick them per alert in the alert editor`}</Muted>}>
      <Tabs value={category} options={ART_CATEGORIES} onChange={setCategory} />
      <div className="grid grid-cols-8 gap-2 pt-3">
        {items.map((item) => (
          <div key={item.id} title={`${item.name} · ${item.license}`} className="flex flex-col items-center gap-1 rounded-[8px] p-2 hover:bg-(--hover)">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.url} alt={item.name} loading="lazy" className="size-16 object-contain" />
            <span className="w-full truncate text-center text-[11px] text-(--text-3)">{item.name}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}

function SoundBrowser() {
  const [category, setCategory] = useState("jingle");
  const [playing, setPlaying] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
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
    <Section title="Alert sounds" aside={<Muted>{`${LIBRARY_SOUNDS.length} sounds · CC0, safe for streams and VODs`}</Muted>}>
      <Tabs value={category} options={SOUND_CATEGORIES} onChange={setCategory} />
      <div className="grid grid-cols-3 gap-x-6 pt-2">
        {LIBRARY_SOUNDS.filter((item) => item.category === category).map((item) => (
          <button key={item.id} type="button" onClick={() => play(item.file)} className="flex min-h-11 items-center gap-3 border-b border-(--line) text-left hover:text-(--text)">
            <span className={`sk-mono flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] ${playing === item.file ? "sk-grain bg-(--accent-fill) text-white" : "bg-(--control) text-(--text-2)"}`}>{playing === item.file ? "■" : "▶"}</span>
            <span className="flex-1 truncate text-[13px] text-(--text-2)">{item.name}</span>
            <span className="sk-mono text-[11px] text-(--text-3)">{item.durationSec.toFixed(1)}s</span>
          </button>
        ))}
      </div>
    </Section>
  );
}

function Tabs({ value, options, onChange }: { value: string; options: { id: string; name: string }[]; onChange: (value: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-(--line)">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={`-mb-px border-b-2 px-2.5 pb-2.5 text-[13px] ${option.id === value ? "border-(--accent) font-medium text-(--text)" : "border-transparent text-(--text-3) hover:text-(--text)"}`}
        >
          {option.name}
        </button>
      ))}
    </div>
  );
}
