"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { PlatformLogo } from "@/components/dashboard/PlatformLogo";
import { buttonClass } from "@/components/dashboard/ui";
import type { SignalKitEvent } from "@/lib/events/types";
import {
  FONTS,
  fontStack,
  googleFontsUrl,
  overlayTypeInfo,
  presetFor,
  TEXT_SHADOWS,
  type AlertKind,
  type AlertSettings,
  type AnySettings,
  type OverlayStyle,
  type OverlayType,
  type PlatformFilter,
} from "@/lib/overlays/settings";
import type { PublicStats } from "@/lib/overlays/stats-core";
import { applyTheme, findTheme, THEMES } from "@/lib/overlays/themes";
import type { PublicLiveTools } from "@/lib/live/types";
import { SAMPLE_BUTTONS, sampleCredits, sampleEvent, sampleLiveTools, sampleStream, type SampleKind } from "@/lib/overlays/samples";
import type { LiveSnapshot } from "@/lib/streams/summary";
import type { OverlayView } from "@/lib/overlays/store";
import { ColorField, Field, Group, Segmented, SelectField, Slider, Toggle } from "./controls";
import { PreviewStage, type StageBackground } from "./PreviewStage";
import { SetupPanel } from "./SetupPanel";
import { TypeSettings } from "./TypeSettings";

type Overlay = OverlayView & { live: boolean };
type SaveState = "saved" | "saving" | "error";

const STYLE_OPTIONS = [
  { value: "classic" as const, label: "Classic" },
  { value: "signal" as const, label: "Signal" },
  { value: "clean" as const, label: "Clean" },
  { value: "bold" as const, label: "Bold" },
];

const ALL_FONTS_URL = googleFontsUrl(FONTS.map((font) => font.id)) ?? "";

export function OverlayEditor({ initial, openSetup }: { initial: Overlay; openSetup: boolean }) {
  const [overlay, setOverlay] = useState(initial);
  const [settings, setSettings] = useState<AnySettings>(initial.settings);
  const [name, setName] = useState(initial.name);
  const [save, setSave] = useState<SaveState>("saved");
  const [events, setEvents] = useState<SignalKitEvent[]>([]);
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [liveTools, setLiveTools] = useState<PublicLiveTools | null>(null);
  const [stream, setStream] = useState<LiveSnapshot | null>(null);
  const [samples] = useState(() => ({ tools: sampleLiveTools(), stream: sampleStream(), credits: sampleCredits() }));
  const [previewSpin, setPreviewSpin] = useState<PublicLiveTools["wheel"]>(null);
  // Sample events use random ids and times, so create them in the browser only (not during SSR).
  useEffect(() => {
    const seed = setTimeout(() => setEvents(seedEvents(initial.type)), 0);
    return () => clearTimeout(seed);
  }, [initial.type]);
  const [demo, setDemo] = useState(DEMO_KINDS[initial.type].length > 0 && initial.type !== "alerts" && initial.type !== "goal" && initial.type !== "label");
  const [background, setBackground] = useState<StageBackground>("gameplay");
  const [setupOpen, setSetupOpen] = useState(openSetup);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const patch = useCallback(
    async (body: { name?: string; settings?: AnySettings }) => {
      setSave("saving");
      const response = await fetch(`/api/overlays/${overlay.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).catch(() => null);
      if (!response?.ok) {
        setSave("error");
        return;
      }
      const json = (await response.json()) as { overlay: Overlay };
      setOverlay(json.overlay);
      setSave("saved");
    },
    [overlay.id],
  );

  // Autosave shortly after the last change; overlays open in OBS update instantly.
  const update = (next: AnySettings) => {
    setSettings(next);
    setSave("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void patch({ settings: next }), 450);
  };

  // Keep "live in OBS" fresh.
  // Keep "live in OBS" and the goal/label stats fresh.
  useEffect(() => {
    const refresh = async () => {
      const response = await fetch(`/api/overlays/${overlay.id}`).catch(() => null);
      if (response?.ok) {
        const json = (await response.json()) as { overlay: Overlay; stats?: PublicStats; stream?: LiveSnapshot };
        setOverlay((current) => ({ ...current, live: json.overlay.live, lastSeenAt: json.overlay.lastSeenAt, url: json.overlay.url }));
        if (json.stats) {
          setStats(json.stats);
        }
        setStream(json.stream ?? null);
      }
    };
    const first = setTimeout(() => void refresh(), 0);
    const poll = setInterval(() => void refresh(), 4000);
    return () => {
      clearTimeout(first);
      clearInterval(poll);
    };
  }, [overlay.id]);

  const sendSample = useCallback(
    (kind: SampleKind, alsoLive: boolean) => {
      setEvents((current) => [...current, sampleEvent(kind)].slice(-120));
      if (alsoLive) {
        void fetch(`/api/overlays/${overlay.id}/test`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind }),
        });
      }
    },
    [overlay.id],
  );

  // Auto demo: a believable mix of events every few seconds, preview only.
  const durationSec = "durationSec" in settings ? settings.durationSec : 0;
  useEffect(() => {
    if (!demo) {
      return;
    }
    let tick = 0;
    const kinds = DEMO_KINDS[overlay.type];
    if (kinds.length === 0) {
      return;
    }
    const every = overlay.type === "chat" ? 1600 : overlay.type === "emotewall" ? 700 : overlay.type === "alerts" ? Math.max(3500, durationSec * 1000 + 1300) : 2600;
    const timer = setInterval(() => {
      tick += 1;
      sendSample(kinds[tick % kinds.length], false);
    }, every);
    return () => clearInterval(timer);
  }, [demo, overlay.type, sendSample, durationSec]);

  const buttons = SAMPLE_BUTTONS.filter((button) => TEST_KINDS[overlay.type].includes(button.kind));
  const toolType = overlay.type === "poll" || overlay.type === "giveaway" || overlay.type === "queue" || overlay.type === "highlight" || overlay.type === "wheel";

  // Live tools: the real poll/giveaway/queue/pin while one runs, otherwise a sample.
  useEffect(() => {
    if (!toolType) {
      return;
    }
    const refresh = async () => {
      const response = await fetch("/api/live").catch(() => null);
      if (response?.ok) {
        setLiveTools(((await response.json()) as { tools: PublicLiveTools }).tools);
      }
    };
    const first = setTimeout(() => void refresh(), 0);
    const poll = setInterval(() => void refresh(), 2000);
    return () => {
      clearTimeout(first);
      clearInterval(poll);
    };
  }, [toolType]);
  const previewTools: PublicLiveTools = {
    poll: liveTools?.poll ?? samples.tools.poll,
    giveaway: liveTools?.giveaway ?? samples.tools.giveaway,
    queue: liveTools?.queue.open || liveTools?.queue.entries.length ? liveTools.queue : samples.tools.queue,
    highlight: liveTools?.highlight ?? samples.tools.highlight,
    // The newest spin: one started from Live tools, or the preview's own Spin button.
    wheel: [liveTools?.wheel, previewSpin].filter(Boolean).sort((a, b) => Date.parse(b!.at) - Date.parse(a!.at))[0] ?? null,
  };
  const info = overlayTypeInfo(overlay.type);

  return (
    <>
      <link rel="stylesheet" href={ALL_FONTS_URL} precedence="default" />
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-(--line) bg-(--surface-panel) pr-4 pl-3">
        <Link href="/dashboard/overlays" aria-label="Back to overlays" className={`${buttonClass("quiet")} size-7 px-0`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <Link href="/dashboard/overlays" className="text-[13px] text-(--text-3) hover:text-(--text)">
          Overlays
        </Link>
        <span className="text-[13px] text-[#555555]">/</span>
        <input
          value={name}
          maxLength={80}
          aria-label="Overlay name"
          onChange={(event) => setName(event.target.value)}
          onBlur={() => name.trim() && name !== overlay.name && void patch({ name })}
          className="h-7 w-56 rounded-(--r) bg-transparent px-2 text-[13px] font-semibold text-(--text) outline-none hover:bg-(--hover) focus:bg-(--surface-inset)"
        />
        <span className="sk-mono rounded-[4px] border border-(--line-strong) px-1.5 py-0.5 text-[11px] text-(--text-3)">{info.name}</span>
        <span className="flex-1" />
        <span className="inline-flex items-center gap-2 text-xs text-(--text-2)">
          <span className={`size-[7px] rounded-full ${save === "saved" ? "bg-(--onair)" : save === "saving" ? "bg-(--warning)" : "bg-(--danger)"}`} />
          {save === "saved" ? "All changes saved" : save === "saving" ? "Saving…" : "Couldn't save"}
        </span>
        <span className="mx-1 h-5 w-px bg-(--line)" />
        <LiveBadge live={overlay.live} />
        <button type="button" className={buttonClass("primary")} onClick={() => setSetupOpen(true)}>
          Add to OBS
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="w-90 shrink-0 overflow-y-auto border-r border-(--line) bg-(--surface-panel) px-5 py-5">
          <LookSettings type={overlay.type} settings={settings} update={update} />
          <TypeSettings type={overlay.type} settings={settings} update={update} overlayId={overlay.id} />
          {"platforms" in settings ? (
            <Group title="Platforms">
              <PlatformToggles value={settings.platforms} onChange={(platforms) => update({ ...settings, platforms } as AnySettings)} />
            </Group>
          ) : null}
          <Group title="Advanced">
            <Field label="Custom CSS" hint="Applied last">
              <textarea
                value={settings.customCss}
                maxLength={10000}
                spellCheck={false}
                rows={5}
                placeholder={CSS_PLACEHOLDER[overlay.type]}
                onChange={(event) => update({ ...settings, customCss: event.target.value })}
                className="sk-mono w-full resize-y rounded-(--r) border border-(--line) bg-(--surface-inset) p-2.5 text-[11px] leading-[17px] text-(--text) outline-none placeholder:text-(--text-3) focus:border-(--accent)"
              />
            </Field>
          </Group>
        </aside>

        <main className="flex min-w-0 flex-1 justify-center overflow-y-auto px-8 py-6">
          <div className="flex w-full max-w-[1280px] flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className="text-[13px] font-semibold text-(--text)">Preview</span>
              <span className="sk-mono text-[11px] text-(--text-3)">
                {info.width} × {info.height} on a 1920 × 1080 stream
              </span>
              <span className="flex-1" />
              <div className="w-72">
                <Segmented
                  value={background}
                  options={[
                    { value: "gameplay", label: "Gameplay" },
                    { value: "chatting", label: "Just chatting" },
                    { value: "transparent", label: "Transparent" },
                  ]}
                  onChange={setBackground}
                />
              </div>
            </div>
            <PreviewStage
              type={overlay.type}
              settings={settings}
              events={events}
              stats={stats}
              overlayId={overlay.id}
              background={background}
              tools={previewTools}
              stream={stream?.live ? stream : samples.stream}
              credits={samples.credits}
            />
            {overlay.type === "wheel" ? (
              <div>
                <button type="button" className={buttonClass("control")} onClick={() => setPreviewSpin({ id: `preview-${Date.now()}`, seed: Math.floor(Math.random() * 2 ** 31), at: new Date().toISOString() })}>
                  Spin (preview only)
                </button>
              </div>
            ) : null}
            {toolType ? (
              <p className="text-xs text-(--text-3)">
                {`Showing ${
                  (overlay.type === "poll" && liveTools?.poll) ||
                  (overlay.type === "giveaway" && liveTools?.giveaway) ||
                  (overlay.type === "queue" && (liveTools?.queue.open || liveTools?.queue.entries.length)) ||
                  (overlay.type === "highlight" && liveTools?.highlight)
                    ? "what's running now"
                    : "a sample"
                }. Run polls, giveaways, the queue and pinned messages from `}
                <Link href="/dashboard/live" className="underline hover:text-(--text)">
                  Live tools
                </Link>
                .
              </p>
            ) : null}
            <div className={`flex flex-wrap items-center gap-2 ${buttons.length === 0 ? "hidden" : ""}`}>
              <span className="mr-1 text-xs text-(--text-3)">Send test</span>
              {buttons.map((button) => {
                const off = overlay.type === "alerts" && button.kind !== "chat.message" && !(settings as AlertSettings).templates[button.kind as AlertKind]?.enabled;
                return (
                  <button key={button.kind} type="button" disabled={off} className={`${buttonClass("control")} disabled:opacity-50`} onClick={() => sendSample(button.kind, overlay.live)}>
                    {button.label}
                  </button>
                );
              })}
              {overlay.type === "chat" || overlay.type === "events" || overlay.type === "ticker" ? (
                <button type="button" className={buttonClass("quiet")} onClick={() => setEvents([])}>
                  Clear
                </button>
              ) : null}
              <span className="flex-1" />
              <div className="w-34">
                <Toggle label="Auto demo" checked={demo} onChange={setDemo} />
              </div>
            </div>
            <p className="text-xs text-(--text-3)">
              {overlay.live
                ? "Tests play here and in your streaming app, never in your real chat or event log."
                : "Tests play here. Once the overlay is in your streaming app, they show up there too."}
            </p>
          </div>
        </main>
      </div>

      {setupOpen ? (
        <SetupPanel
          overlay={overlay}
          onClose={() => setSetupOpen(false)}
          onReset={(next) => setOverlay(next)}
          onTest={() => sendSample(overlay.type === "chat" || overlay.type === "emotewall" ? "chat.message" : "follow", true)}
        />
      ) : null}
    </>
  );
}

const CSS_PLACEHOLDER: Record<OverlayType, string> = {
  alerts: ".sko-classic-title { text-transform: uppercase; }\n.sko-hl { color: gold; }",
  chat: ".sko-chat-line { margin-left: 1em; }\n.sko-chat-name { text-decoration: underline; }",
  events: ".sko-list-item { border-radius: 0; }",
  goal: ".sko-goal-bar { border: 2px solid #fff; }",
  label: ".sko-label-text { letter-spacing: 0.05em; }",
  emotewall: ".sko-sprite { filter: drop-shadow(0 4px 8px #000); }",
  ticker: ".sko-ticker-title { background: crimson; }",
  poll: ".sko-poll-fill { border-radius: 999px; }",
  giveaway: ".sko-giveaway-name { font-size: 2.4em; }",
  queue: ".sko-queue-list li { padding: 0.2em 0; }",
  highlight: ".sko-highlight { border: 2px solid var(--sko-accent); }",
  viewers: ".sko-viewers-label { text-transform: uppercase; }",
  credits: ".sko-credits-heading { color: gold; }",
  twitch: ".sko-box-title { text-transform: uppercase; }",
  wheel: ".sko-wheel-result { background: crimson; }",
  boss: ".sko-boss-name { text-transform: uppercase; }",
};

/** Test buttons each overlay type offers, and what the auto demo cycles through. */
const TEST_KINDS: Record<OverlayType, SampleKind[]> = {
  alerts: ["follow", "subscription", "subscription.gift", "cheer", "tip", "raid", "redemption"],
  chat: ["chat.message", "cheer", "tip", "subscription"],
  events: ["follow", "subscription", "subscription.gift", "cheer", "tip", "raid", "redemption"],
  goal: ["follow", "subscription", "subscription.gift", "cheer", "tip", "raid"],
  label: ["follow", "subscription", "subscription.gift", "cheer", "tip", "raid"],
  emotewall: ["chat.message", "subscription", "cheer", "raid"],
  ticker: ["follow", "subscription", "subscription.gift", "cheer", "tip", "raid"],
  poll: [],
  giveaway: [],
  queue: [],
  highlight: [],
  viewers: [],
  credits: [],
  twitch: [],
  wheel: [],
  boss: ["follow", "subscription", "subscription.gift", "cheer", "tip", "raid"],
};
const DEMO_KINDS: Record<OverlayType, SampleKind[]> = {
  alerts: ["follow", "cheer", "subscription", "tip", "raid", "subscription.gift", "redemption"],
  chat: ["chat.message", "chat.message", "chat.message", "cheer", "chat.message", "chat.message", "subscription"],
  events: ["follow", "cheer", "subscription", "tip", "raid"],
  goal: ["follow", "subscription", "cheer", "tip"],
  label: ["follow", "subscription", "cheer", "tip"],
  emotewall: ["chat.message", "chat.message", "chat.message", "chat.message", "chat.message", "chat.message", "chat.message", "chat.message", "subscription"],
  ticker: ["follow", "cheer", "subscription", "tip", "raid"],
  poll: [],
  giveaway: [],
  queue: [],
  highlight: [],
  viewers: [],
  credits: [],
  twitch: [],
  wheel: [],
  boss: ["follow", "subscription", "subscription.gift", "cheer", "tip", "raid"],
};

const WEIGHTS = [400, 500, 600, 700, 800, 900];

function LookSettings({ type, settings, update }: { type: OverlayType; settings: AnySettings; update: (next: AnySettings) => void }) {
  return (
    <Group title="Look">
      <Field label="Theme pack" hint="Restyles this overlay; text and media stay">
        <SelectField
          value=""
          options={[{ value: "", label: "Choose a theme…" }, ...THEMES.map((theme) => ({ value: theme.id, label: theme.name }))]}
          onChange={(id) => {
            const theme = findTheme(id);
            if (theme) {
              update(applyTheme(type, settings, theme));
            }
          }}
        />
      </Field>
      <Field label="Style" hint="Sets colours and type you can change below">
        <Segmented value={settings.style} options={STYLE_OPTIONS} onChange={(style: OverlayStyle) => update({ ...settings, style, ...presetFor(style, type) })} />
      </Field>
      <div className="grid grid-cols-[1fr_88px] gap-2">
        <Field label="Font">
          <SelectField value={settings.font} options={FONTS.map((font) => ({ value: font.id, label: font.name }))} fontFor={fontStack} onChange={(font) => update({ ...settings, font })} />
        </Field>
        <Field label="Weight">
          <SelectField
            value={String(settings.fontWeight)}
            options={WEIGHTS.map((weight) => ({ value: String(weight), label: String(weight) }))}
            onChange={(weight) => update({ ...settings, fontWeight: Number(weight) })}
          />
        </Field>
      </div>
      <div className="flex flex-col gap-2.5">
        <ColorField label="Text" value={settings.textColor} onChange={(textColor) => update({ ...settings, textColor })} />
        <ColorField label="Highlight" value={settings.accentColor} onChange={(accentColor) => update({ ...settings, accentColor })} />
        <ColorField label="Background" value={settings.panelColor} onChange={(panelColor) => update({ ...settings, panelColor })} />
      </div>
      <Field label="Background opacity">
        <Slider value={settings.panelOpacity} min={0} max={1} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onChange={(panelOpacity) => update({ ...settings, panelOpacity })} />
      </Field>
      <Field label="Corner radius">
        <Slider value={settings.radius} min={0} max={40} step={1} format={(v) => `${v}px`} onChange={(radius) => update({ ...settings, radius })} />
      </Field>
      <Field label="Text shadow">
        <Segmented value={settings.textShadow} options={TEXT_SHADOWS.map(([value, label]) => ({ value, label }))} onChange={(textShadow) => update({ ...settings, textShadow })} />
      </Field>
      <Field label="Overall size">
        <Slider value={settings.scale} min={0.5} max={2.5} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onChange={(scale) => update({ ...settings, scale })} />
      </Field>
    </Group>
  );
}

function PlatformToggles({ value, onChange }: { value: PlatformFilter; onChange: (value: PlatformFilter) => void }) {
  return (
    <div className="flex flex-col gap-2.5">
      {(["twitch", "youtube", "x"] as const).map((platform) => (
        <Toggle key={platform} label={platform === "x" ? "X" : platform === "youtube" ? "YouTube" : "Twitch"} checked={value[platform]} onChange={(checked) => onChange({ ...value, [platform]: checked })}>
          <span className="flex w-4 justify-center">
            <PlatformLogo platform={platform} size={14} />
          </span>
        </Toggle>
      ))}
    </div>
  );
}

export function LiveBadge({ live }: { live: boolean }) {
  return (
    <span className={`inline-flex h-6.5 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium ${live ? "bg-[rgb(61_203_99/14%)] text-[#7fe39b]" : "bg-(--control) text-(--text-3)"}`}>
      <span className={`size-[7px] rounded-full ${live ? "bg-(--onair)" : "bg-[#555555]"}`} />
      {live ? "Live in OBS" : "Not in OBS yet"}
    </span>
  );
}

/** Chat and event lists start with a few messages so the preview isn't empty. */
function seedEvents(type: OverlayType): SignalKitEvent[] {
  if (type === "chat") {
    return [1, 2, 3, 4, 5].map((seed) => sampleEvent("chat.message", seed));
  }
  if (type === "twitch") {
    return twitchSamples();
  }
  if (type === "events" || type === "ticker") {
    return (["follow", "subscription", "cheer", "tip", "raid"] as SampleKind[]).map((kind, index) => sampleEvent(kind, index + 1));
  }
  return [];
}

/** Sample Twitch hype train, poll and prediction so the Twitch activity preview isn't empty. */
function twitchSamples(): SignalKitEvent[] {
  const base = sampleEvent("follow", 1);
  const make = (kind: SignalKitEvent["kind"], data: Record<string, unknown>): SignalKitEvent => ({ ...base, id: `${base.id}_${kind}`, kind, platform: "twitch", actor: null, data });
  return [
    make("hype_train", { phase: "progress", level: 3, total: 3400, goal: 5000 }),
    make("poll", { phase: "progress", title: "Best boss so far?", choices: [{ title: "Malenia", votes: 58 }, { title: "Radahn", votes: 31 }, { title: "Godrick", votes: 12 }] }),
    make("prediction", { phase: "progress", title: "Beat it first try?", outcomes: [{ title: "Yes", color: "blue", channel_points: 24000 }, { title: "No way", color: "pink", channel_points: 51000 }] }),
  ];
}
