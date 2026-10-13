"use client";

import { useState } from "react";
import { buttonClass } from "@/components/dashboard/ui";
import { ALERT_PACKS, artCredit, soundName } from "@/lib/library";
import {
  ALERT_KIND_LABEL,
  ALERT_KINDS,
  ANIMATIONS_IN,
  defaultArt,
  ANIMATIONS_OUT,
  LABEL_KINDS,
  TEMPLATE_VARIABLES,
  TEXT_ANIMATIONS,
  VARIATION_UNIT,
  type AlertKind,
  type AlertSettings,
  type AlertTemplate,
  type AnySettings,
  type ChatSettings,
  type EmoteWallSettings,
  type EventListSettings,
  type GoalSettings,
  type LabelSettings,
  type OverlayType,
  type TickerSettings,
} from "@/lib/overlays/settings";
import { ColorField, DateField, Field, Group, NumberField, PositionGrid, Segmented, SelectField, Slider, TemplateField, TextField, Toggle } from "./controls";
import { MediaPicker } from "./MediaPicker";

type Update = (next: AnySettings) => void;

const options = <T extends string>(list: readonly (readonly [T, string, ...string[]])[]) => list.map(([value, label]) => ({ value, label }));
const seconds = (v: number) => (v === 0 ? "Off" : `${v}s`);
const px = (v: number) => `${v}px`;

/** Settings specific to each overlay type, below the shared Look section. */
export function TypeSettings({ type, settings, update, overlayId }: { type: OverlayType; settings: AnySettings; update: Update; overlayId: string }) {
  switch (type) {
    case "alerts":
      return <AlertTypeSettings settings={settings as AlertSettings} update={update} />;
    case "chat":
      return <ChatTypeSettings settings={settings as ChatSettings} update={update} />;
    case "events":
      return <EventListTypeSettings settings={settings as EventListSettings} update={update} />;
    case "goal":
      return <GoalTypeSettings settings={settings as GoalSettings} update={update} overlayId={overlayId} />;
    case "label":
      return <LabelTypeSettings settings={settings as LabelSettings} update={update} />;
    case "emotewall":
      return <EmoteWallTypeSettings settings={settings as EmoteWallSettings} update={update} />;
    case "ticker":
      return <TickerTypeSettings settings={settings as TickerSettings} update={update} />;
  }
}

// ---- Alerts ---------------------------------------------------------------------------------

function AlertTypeSettings({ settings: s, update }: { settings: AlertSettings; update: Update }) {
  const [kind, setKind] = useState<AlertKind>("follow");
  const [picker, setPicker] = useState<"art" | "sound" | null>(null);
  const template = s.templates[kind];
  const setTemplate = (patch: Partial<AlertTemplate>) => update({ ...s, templates: { ...s.templates, [kind]: { ...template, ...patch } } });
  const enabledCount = ALERT_KINDS.filter((k) => s.templates[k].enabled).length;
  const classic = s.style === "classic";
  const unit = VARIATION_UNIT[kind];
  const soundFile = kind === "subscription.gift" ? "gift" : kind;
  return (
    <>
      <Group title={`Events · ${enabledCount} of ${ALERT_KINDS.length}`}>
        <div className="flex flex-col gap-2.5">
          {ALERT_KINDS.map((k) => (
            <Toggle key={k} label={ALERT_KIND_LABEL[k]} checked={s.templates[k].enabled} onChange={(enabled) => update({ ...s, templates: { ...s.templates, [k]: { ...s.templates[k], enabled } } })} />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Min tip">
            <NumberField value={s.minTip} onChange={(minTip) => update({ ...s, minTip })} max={100000} />
          </Field>
          <Field label="Min bits">
            <NumberField value={s.minCheer} onChange={(minCheer) => update({ ...s, minCheer })} max={1000000} />
          </Field>
          <Field label="Min raid">
            <NumberField value={s.minRaid} onChange={(minRaid) => update({ ...s, minRaid })} max={100000} />
          </Field>
        </div>
      </Group>

      <Group title="Alert content">
        <Field label="Alert pack" hint="Art and sound for every alert">
          <SelectField
            value=""
            options={[{ value: "", label: "Choose a pack…" }, ...ALERT_PACKS.map((pack) => ({ value: pack.id, label: `${pack.name}: ${pack.description}` }))]}
            onChange={(id) => {
              const pack = ALERT_PACKS.find((item) => item.id === id);
              if (pack) {
                const templates = Object.fromEntries(ALERT_KINDS.map((k) => [k, { ...s.templates[k], ...pack.media[k], showImage: true }])) as AlertSettings["templates"];
                update({ ...s, templates });
              }
            }}
          />
        </Field>
        <Field label="Edit alert">
          <SelectField value={kind} options={ALERT_KINDS.map((k) => ({ value: k, label: ALERT_KIND_LABEL[k] }))} onChange={setKind} />
        </Field>
        <Field label="Message template">
          <TemplateField value={template.title} onChange={(title) => setTemplate({ title })} variables={TEMPLATE_VARIABLES} />
        </Field>
        {classic ? null : (
          <Field label="Label">
            <TextField value={template.label} onChange={(label) => setTemplate({ label })} />
          </Field>
        )}
        <Toggle label="Show image" checked={template.showImage} onChange={(showImage) => setTemplate({ showImage })} />
        {template.showImage ? (
          <Field label="Image, GIF or video" hint="HTTPS URL">
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={template.image || defaultArt(kind)} alt="" className="size-8 shrink-0 rounded-[4px] bg-(--surface-inset) object-contain" />
              <TextField value={template.image} onChange={(image) => setTemplate({ image: image.trim() })} placeholder={classic ? "Signal Kit art" : "Avatar (no image)"} maxLength={2048} mono />
              <button type="button" className={`${buttonClass("control")} shrink-0`} onClick={() => setPicker("art")}>
                Library
              </button>
            </div>
            {artCredit(template.image) ? <span className="text-[11px] text-(--text-3)">{artCredit(template.image)}</span> : null}
          </Field>
        ) : null}
        <Field label="Sound" hint="HTTPS URL to MP3, OGG or WAV">
          <div className="flex items-center gap-2">
            {soundName(template.sound) ? (
              <span className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-(--r) border border-(--line) bg-(--surface-inset) pr-1 pl-2.5 text-[13px] text-(--text)">
                <span className="flex-1 truncate">{soundName(template.sound)}</span>
                <button type="button" aria-label="Use the default sound" className="px-1.5 text-(--text-3) hover:text-(--text)" onClick={() => setTemplate({ sound: "" })}>
                  ✕
                </button>
              </span>
            ) : (
              <TextField value={template.sound} onChange={(sound) => setTemplate({ sound: sound.trim() })} placeholder="Signal Kit sound" maxLength={2048} mono />
            )}
            <button type="button" className={`${buttonClass("control")} shrink-0`} onClick={() => void new Audio(template.sound || `/alerts/sounds/${soundFile}.mp3`).play().catch(() => {})}>
              Play
            </button>
            <button type="button" className={`${buttonClass("control")} shrink-0`} onClick={() => setPicker("sound")}>
              Library
            </button>
          </div>
        </Field>
        {picker ? (
          <MediaPicker
            mode={picker}
            kind={kind}
            current={picker === "art" ? template.image : template.sound}
            onClose={() => setPicker(null)}
            onPick={(value) => {
              setTemplate(picker === "art" ? { image: value, showImage: true } : { sound: value });
              setPicker(null);
            }}
          />
        ) : null}
        {unit ? <Variations template={template} unit={unit} onChange={(variations) => setTemplate({ variations })} /> : null}
      </Group>

      <Group title="Layout">
        {classic ? (
          <Field label="Layout">
            <Segmented
              value={s.layout}
              options={[
                { value: "above", label: "Image above" },
                { value: "side", label: "Side by side" },
                { value: "banner", label: "Text on image" },
              ]}
              onChange={(layout) => update({ ...s, layout })}
            />
          </Field>
        ) : null}
        <div className="flex items-start gap-5">
          <Field label="Position">
            <PositionGrid value={s.position} onChange={(position) => update({ ...s, position })} />
          </Field>
          <div className="flex flex-1 flex-col gap-3">
            {classic ? (
              <>
                <Field label="Text size">
                  <Slider value={s.titleSize} min={16} max={140} step={2} format={px} onChange={(titleSize) => update({ ...s, titleSize })} />
                </Field>
                <Field label="Image size">
                  <Slider value={s.imageSize} min={60} max={800} step={10} format={px} onChange={(imageSize) => update({ ...s, imageSize })} />
                </Field>
              </>
            ) : (
              <Toggle label="Avatars" checked={s.showAvatar} onChange={(showAvatar) => update({ ...s, showAvatar })} />
            )}
          </div>
        </div>
        <Toggle label="Show the viewer's message" checked={s.showMessage} onChange={(showMessage) => update({ ...s, showMessage })} />
        {s.showMessage && classic ? (
          <>
            <Field label="Message size">
              <Slider value={s.messageSize} min={12} max={80} step={1} format={px} onChange={(messageSize) => update({ ...s, messageSize })} />
            </Field>
            <ColorField label="Message colour" value={s.messageColor} onChange={(messageColor) => update({ ...s, messageColor })} />
          </>
        ) : null}
      </Group>

      <Group title="Motion">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Enter">
            <SelectField value={s.animationIn} options={options(ANIMATIONS_IN)} onChange={(animationIn) => update({ ...s, animationIn })} />
          </Field>
          <Field label="Exit">
            <SelectField value={s.animationOut} options={options(ANIMATIONS_OUT)} onChange={(animationOut) => update({ ...s, animationOut })} />
          </Field>
        </div>
        <Field label="Text animation" hint="On names and amounts">
          <SelectField value={s.textAnimation} options={options(TEXT_ANIMATIONS)} onChange={(textAnimation) => update({ ...s, textAnimation })} />
        </Field>
        <Field label="Show each alert for">
          <Slider value={s.durationSec} min={2} max={30} step={1} format={(v) => `${v}s`} onChange={(durationSec) => update({ ...s, durationSec })} />
        </Field>
        <Field label="Text appears after">
          <Slider value={s.textDelaySec} min={0} max={5} step={0.5} format={seconds} onChange={(textDelaySec) => update({ ...s, textDelaySec })} />
        </Field>
        <Field label="Pause between alerts">
          <Slider value={s.gapSec} min={0} max={10} step={0.5} format={seconds} onChange={(gapSec) => update({ ...s, gapSec })} />
        </Field>
      </Group>

      <Group title="Sound">
        <Toggle label="Play sounds" checked={s.sound} onChange={(sound) => update({ ...s, sound })} />
        {s.sound ? (
          <Field label="Volume">
            <Slider value={s.volume} min={0} max={1} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onChange={(volume) => update({ ...s, volume })} />
          </Field>
        ) : null}
        <p className="text-xs leading-[18px] text-(--text-3)">In OBS, tick “Control audio via OBS” to mix alert sounds with your other sources.</p>
      </Group>

      <Group title="Moderation">
        <Field label="Hide messages containing" hint="Comma-separated">
          <TextField value={s.blockedWords} onChange={(blockedWords) => update({ ...s, blockedWords })} placeholder="spoiler, link" maxLength={2000} />
        </Field>
      </Group>
    </>
  );
}

/** Bigger alerts for bigger moments: tips over $50, 12-month resubs, 10+ gifted subs… */
function Variations({ template, unit, onChange }: { template: AlertTemplate; unit: string; onChange: (variations: AlertTemplate["variations"]) => void }) {
  const list = template.variations;
  const set = (index: number, patch: Partial<AlertTemplate["variations"][number]>) => onChange(list.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] font-medium text-(--text)">Variations</span>
        <span className="text-xs text-(--text-3)">The highest match wins</span>
      </div>
      {list.map((variation, index) => (
        <div key={index} className="flex flex-col gap-2 rounded-(--r) border border-(--line) p-2.5">
          <div className="flex items-center gap-2 text-xs text-(--text-2)">
            <span className="shrink-0">At least</span>
            <div className="w-24">
              <NumberField value={variation.min} onChange={(min) => set(index, { min })} min={1} />
            </div>
            <span className="flex-1 truncate">{unit}</span>
            <button type="button" className={`${buttonClass("quiet")} h-7 px-2 text-xs`} onClick={() => onChange(list.filter((_, i) => i !== index))}>
              Remove
            </button>
          </div>
          <TextField value={variation.title} onChange={(title) => set(index, { title })} placeholder={template.title} />
          <TextField value={variation.image} onChange={(image) => set(index, { image: image.trim() })} placeholder="Image URL (same as the alert)" maxLength={2048} mono />
          <TextField value={variation.sound} onChange={(sound) => set(index, { sound: sound.trim() })} placeholder="Sound URL (same as the alert)" maxLength={2048} mono />
        </div>
      ))}
      {list.length < 8 ? (
        <button
          type="button"
          className={`${buttonClass("control")} self-start`}
          onClick={() => onChange([...list, { min: Math.max(1, ...list.map((item) => item.min * 2)), title: "", image: "", sound: "" }])}
        >
          Add variation
        </button>
      ) : null}
    </div>
  );
}

// ---- Chat -----------------------------------------------------------------------------------

function ChatTypeSettings({ settings: s, update }: { settings: ChatSettings; update: Update }) {
  const classic = s.style === "classic";
  return (
    <>
      <Group title="Messages">
        {classic ? (
          <Field label="Layout">
            <Segmented
              value={s.layout}
              options={[
                { value: "inline", label: "Twitch" },
                { value: "columns", label: "Name column" },
                { value: "boxed", label: "Boxed" },
              ]}
              onChange={(layout) => update({ ...s, layout, ...(layout === "boxed" && s.panelOpacity === 0 ? { panelOpacity: 0.6, radius: Math.max(s.radius, 8) } : {}) })}
            />
          </Field>
        ) : null}
        {classic ? (
          <Field label="Text size">
            <Slider value={s.fontSize} min={10} max={60} step={1} format={px} onChange={(fontSize) => update({ ...s, fontSize })} />
          </Field>
        ) : null}
        <Field label="Newest at">
          <Segmented
            value={s.newestAt}
            options={[
              { value: "bottom", label: "Bottom" },
              { value: "top", label: "Top" },
            ]}
            onChange={(newestAt) => update({ ...s, newestAt })}
          />
        </Field>
        <Field label="Message animation">
          <SelectField value={s.animation} options={options(ANIMATIONS_IN)} onChange={(animation) => update({ ...s, animation })} />
        </Field>
        <Field label="Most on screen">
          <Slider value={s.maxMessages} min={3} max={60} step={1} format={(v) => `${v}`} onChange={(maxMessages) => update({ ...s, maxMessages })} />
        </Field>
        <Field label="Hide each message after">
          <Slider value={s.lifetimeSec} min={0} max={120} step={5} format={(v) => (v === 0 ? "Never" : `${v}s`)} onChange={(lifetimeSec) => update({ ...s, lifetimeSec })} />
        </Field>
        <Field label="Chat delay" hint="Time to delete before it's on stream">
          <Slider value={s.delaySec} min={0} max={10} step={1} format={seconds} onChange={(delaySec) => update({ ...s, delaySec })} />
        </Field>
      </Group>
      <Group title="Show">
        <Toggle label="Tips, cheers and Super Chats (highlighted)" checked={s.showTips} onChange={(showTips) => update({ ...s, showTips })} />
        <Toggle label="Subs and gift subs (highlighted)" checked={s.showSubs} onChange={(showSubs) => update({ ...s, showSubs })} />
        <Toggle label="Hide !commands" checked={s.hideCommands} onChange={(hideCommands) => update({ ...s, hideCommands })} />
        <Toggle label="Hide bots (Nightbot, StreamElements…)" checked={s.hideBots} onChange={(hideBots) => update({ ...s, hideBots })} />
      </Group>
      <Group title="Details">
        <Toggle label="Avatars" checked={s.showAvatars} onChange={(showAvatars) => update({ ...s, showAvatars })} />
        <Toggle label="Platform logos" checked={s.showPlatform} onChange={(showPlatform) => update({ ...s, showPlatform })} />
        <Toggle label="Badges (mod, sub, member, verified)" checked={s.showBadges} onChange={(showBadges) => update({ ...s, showBadges })} />
        {classic && s.layout !== "columns" ? <Toggle label="Colon after names" checked={s.showColon} onChange={(showColon) => update({ ...s, showColon })} /> : null}
        <Field label="Name colour">
          <Segmented
            value={s.nameColor}
            options={[
              { value: "viewer", label: "Viewer's own" },
              { value: "accent", label: "Highlight" },
            ]}
            onChange={(nameColor) => update({ ...s, nameColor })}
          />
        </Field>
      </Group>
      <Group title="Moderation">
        <Field label="Muted viewers" hint="Comma-separated names">
          <TextField value={s.mutedUsers} onChange={(mutedUsers) => update({ ...s, mutedUsers })} placeholder="annoying_bot, spammer" maxLength={2000} />
        </Field>
        <Field label="Hide messages containing" hint="Comma-separated">
          <TextField value={s.blockedWords} onChange={(blockedWords) => update({ ...s, blockedWords })} placeholder="spoiler, link" maxLength={2000} />
        </Field>
      </Group>
    </>
  );
}

// ---- Event list & ticker --------------------------------------------------------------------

function KindToggles({ value, onChange }: { value: Record<AlertKind, boolean>; onChange: (value: Record<AlertKind, boolean>) => void }) {
  return (
    <div className="flex flex-col gap-2.5">
      {ALERT_KINDS.map((kind) => (
        <Toggle key={kind} label={ALERT_KIND_LABEL[kind]} checked={value[kind]} onChange={(checked) => onChange({ ...value, [kind]: checked })} />
      ))}
    </div>
  );
}

function EventListTypeSettings({ settings: s, update }: { settings: EventListSettings; update: Update }) {
  return (
    <>
      <Group title="Events">
        <KindToggles value={s.kinds} onChange={(kinds) => update({ ...s, kinds })} />
      </Group>
      <Group title="List">
        {s.style === "classic" ? (
          <Field label="Text size">
            <Slider value={s.fontSize} min={10} max={48} step={1} format={px} onChange={(fontSize) => update({ ...s, fontSize })} />
          </Field>
        ) : null}
        <Field label="Newest at">
          <Segmented
            value={s.newestAt}
            options={[
              { value: "top", label: "Top" },
              { value: "bottom", label: "Bottom" },
            ]}
            onChange={(newestAt) => update({ ...s, newestAt })}
          />
        </Field>
        <Field label="Show up to">
          <Slider value={s.maxItems} min={1} max={20} step={1} format={(v) => `${v}`} onChange={(maxItems) => update({ ...s, maxItems })} />
        </Field>
        <Field label="Animation">
          <SelectField value={s.animation} options={options(ANIMATIONS_IN)} onChange={(animation) => update({ ...s, animation })} />
        </Field>
        <Toggle label="Avatars" checked={s.showAvatars} onChange={(showAvatars) => update({ ...s, showAvatars })} />
        <Toggle label="Platform logos" checked={s.showPlatform} onChange={(showPlatform) => update({ ...s, showPlatform })} />
      </Group>
    </>
  );
}

function TickerTypeSettings({ settings: s, update }: { settings: TickerSettings; update: Update }) {
  return (
    <>
      <Group title="Events">
        <KindToggles value={s.kinds} onChange={(kinds) => update({ ...s, kinds })} />
      </Group>
      <Group title="Ticker">
        <Field label="Title" hint="Leave empty to hide">
          <TextField value={s.title} onChange={(title) => update({ ...s, title })} />
        </Field>
        <Field label="Text size">
          <Slider value={s.fontSize} min={10} max={60} step={1} format={px} onChange={(fontSize) => update({ ...s, fontSize })} />
        </Field>
        <Field label="Speed">
          <Slider value={s.speed} min={20} max={300} step={10} format={(v) => `${v}px/s`} onChange={(speed) => update({ ...s, speed })} />
        </Field>
        <Field label="Show up to">
          <Slider value={s.maxItems} min={3} max={30} step={1} format={(v) => `${v}`} onChange={(maxItems) => update({ ...s, maxItems })} />
        </Field>
        <Field label="Separator">
          <TextField value={s.separator} onChange={(separator) => update({ ...s, separator })} maxLength={8} />
        </Field>
      </Group>
    </>
  );
}

// ---- Goal -----------------------------------------------------------------------------------

const GOAL_METRICS: { value: GoalSettings["metric"]; label: string; title: string }[] = [
  { value: "followers", label: "New followers", title: "Follower goal" },
  { value: "subs", label: "Subs & memberships", title: "Sub goal" },
  { value: "gifts", label: "Gifted subs", title: "Gift sub goal" },
  { value: "bits", label: "Bits", title: "Bits goal" },
  { value: "tips", label: "Tips & Super Chats", title: "Tip goal" },
  { value: "members", label: "YouTube members", title: "Member goal" },
  { value: "raids", label: "Raids", title: "Raid goal" },
];

function GoalTypeSettings({ settings: s, update, overlayId }: { settings: GoalSettings; update: Update; overlayId: string }) {
  const [restarting, setRestarting] = useState(false);
  const restart = async () => {
    setRestarting(true);
    await fetch(`/api/overlays/${overlayId}/goal`, { method: "POST" }).catch(() => null);
    setRestarting(false);
  };
  return (
    <>
      <Group title="Goal">
        <Field label="Counts">
          <SelectField
            value={s.metric}
            options={GOAL_METRICS}
            onChange={(metric) => {
              const wasDefaultTitle = GOAL_METRICS.some((m) => m.title === s.title);
              update({ ...s, metric, ...(wasDefaultTitle ? { title: GOAL_METRICS.find((m) => m.value === metric)!.title } : {}) });
            }}
          />
        </Field>
        {s.metric === "tips" ? (
          <Field label="Currency" hint="Tips in other currencies don't count">
            <TextField value={s.currency} onChange={(currency) => update({ ...s, currency: currency.toUpperCase() })} maxLength={3} mono />
          </Field>
        ) : null}
        <Field label="Title">
          <TextField value={s.title} onChange={(title) => update({ ...s, title })} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Target">
            <NumberField value={s.target} onChange={(target) => update({ ...s, target })} min={1} />
          </Field>
          <Field label="Start from">
            <NumberField value={s.startValue} onChange={(startValue) => update({ ...s, startValue })} />
          </Field>
        </div>
        <Field label="Ends" hint="Optional">
          <DateField value={s.endDate} onChange={(endDate) => update({ ...s, endDate })} />
        </Field>
        <div className="flex items-center gap-3">
          <button type="button" className={buttonClass("control")} disabled={restarting} onClick={() => void restart()}>
            {restarting ? "Restarting…" : "Restart count"}
          </button>
          <span className="text-xs leading-[18px] text-(--text-3)">Counts from now, plus “Start from”.</span>
        </div>
      </Group>
      <Group title="Bar">
        <Field label="Layout">
          <Segmented
            value={s.layout}
            options={[
              { value: "standard", label: "Standard" },
              { value: "condensed", label: "Condensed" },
              { value: "simple", label: "One line" },
            ]}
            onChange={(layout) => update({ ...s, layout })}
          />
        </Field>
        <div className="flex flex-col gap-2.5">
          <ColorField label="Bar" value={s.barColor} onChange={(barColor) => update({ ...s, barColor })} />
          <ColorField label="Bar background" value={s.barBackground} onChange={(barBackground) => update({ ...s, barBackground })} />
          <ColorField label="Bar text" value={s.barTextColor} onChange={(barTextColor) => update({ ...s, barTextColor })} />
        </div>
        {s.layout !== "simple" ? (
          <Field label="Bar height">
            <Slider value={s.barHeight} min={16} max={128} step={4} format={px} onChange={(barHeight) => update({ ...s, barHeight })} />
          </Field>
        ) : null}
        <Toggle label="Show percentage" checked={s.showPercent} onChange={(showPercent) => update({ ...s, showPercent })} />
      </Group>
    </>
  );
}

// ---- Label ----------------------------------------------------------------------------------

function LabelTypeSettings({ settings: s, update }: { settings: LabelSettings; update: Update }) {
  const money = s.label.includes("tip");
  return (
    <Group title="Label">
      <Field label="Shows">
        <SelectField
          value={s.label}
          options={LABEL_KINDS.map(([value, label]) => ({ value, label }))}
          onChange={(label) => update({ ...s, label, template: LABEL_KINDS.find(([value]) => value === label)![2] })}
        />
      </Field>
      <Field label="Text">
        <TemplateField value={s.template} onChange={(template) => update({ ...s, template })} variables={["name", "amount", "count", "list"]} />
      </Field>
      <Field label="Before there's anything to show" hint="Optional">
        <TextField value={s.emptyText} onChange={(emptyText) => update({ ...s, emptyText })} placeholder="Be the first!" />
      </Field>
      {money ? (
        <Field label="Currency">
          <TextField value={s.currency} onChange={(currency) => update({ ...s, currency: currency.toUpperCase() })} maxLength={3} mono />
        </Field>
      ) : null}
      <Field label="Text size">
        <Slider value={s.fontSize} min={10} max={96} step={1} format={px} onChange={(fontSize) => update({ ...s, fontSize })} />
      </Field>
      <Field label="Align">
        <Segmented
          value={s.align}
          options={[
            { value: "left", label: "Left" },
            { value: "center", label: "Center" },
            { value: "right", label: "Right" },
          ]}
          onChange={(align) => update({ ...s, align })}
        />
      </Field>
      <Toggle label="Scroll" checked={s.scroll} onChange={(scroll) => update({ ...s, scroll })} />
      {s.scroll ? (
        <Field label="Scroll speed">
          <Slider value={s.scrollSpeed} min={10} max={300} step={10} format={(v) => `${v}px/s`} onChange={(scrollSpeed) => update({ ...s, scrollSpeed })} />
        </Field>
      ) : null}
      <p className="text-xs leading-[18px] text-(--text-3)">Counts start when Signal Kit starts tracking; “today” restarts each time you go live.</p>
    </Group>
  );
}

// ---- Emote wall -----------------------------------------------------------------------------

const EXPLODE_KINDS: { kind: keyof EmoteWallSettings["explodeOn"]; label: string }[] = [
  { kind: "subscription", label: "Subs & memberships" },
  { kind: "subscription.gift", label: "Gift subs" },
  { kind: "cheer", label: "Cheers" },
  { kind: "tip", label: "Tips & Super Chats" },
  { kind: "raid", label: "Raids" },
  { kind: "follow", label: "Follows" },
];

function EmoteWallTypeSettings({ settings: s, update }: { settings: EmoteWallSettings; update: Update }) {
  return (
    <>
      <Group title="Emotes">
        <Field label="Animation">
          <SelectField
            value={s.animation}
            options={[
              { value: "random", label: "Mix of all" },
              { value: "rise", label: "Rise" },
              { value: "bounce", label: "Bounce" },
              { value: "rain", label: "Rain" },
              { value: "fountain", label: "Fountain" },
              { value: "zoom", label: "Zoom" },
              { value: "float", label: "Float across" },
            ]}
            onChange={(animation) => update({ ...s, animation })}
          />
        </Field>
        <Field label="Emote size">
          <Slider value={s.emoteSize} min={32} max={300} step={4} format={px} onChange={(emoteSize) => update({ ...s, emoteSize })} />
        </Field>
        <Field label="On screen for">
          <Slider value={s.durationSec} min={2} max={20} step={1} format={(v) => `${v}s`} onChange={(durationSec) => update({ ...s, durationSec })} />
        </Field>
        <Field label="Most on screen">
          <Slider value={s.maxOnScreen} min={5} max={300} step={5} format={(v) => `${v}`} onChange={(maxOnScreen) => update({ ...s, maxOnScreen })} />
        </Field>
        <Field label="Per message">
          <Slider value={s.perMessage} min={1} max={20} step={1} format={(v) => `${v}`} onChange={(perMessage) => update({ ...s, perMessage })} />
        </Field>
        <Toggle label="Include emoji" checked={s.includeEmoji} onChange={(includeEmoji) => update({ ...s, includeEmoji })} />
      </Group>
      <Group title="Combos">
        <Field label="Show an emote once it's used" hint={s.comboMin === 1 ? "Every time" : `${s.comboMin}× in ${s.comboWindowSec}s`}>
          <Slider value={s.comboMin} min={1} max={20} step={1} format={(v) => `${v}×`} onChange={(comboMin) => update({ ...s, comboMin })} />
        </Field>
        {s.comboMin > 1 ? (
          <Field label="Within">
            <Slider value={s.comboWindowSec} min={2} max={60} step={1} format={(v) => `${v}s`} onChange={(comboWindowSec) => update({ ...s, comboWindowSec })} />
          </Field>
        ) : null}
      </Group>
      <Group title="Bursts">
        <div className="flex flex-col gap-2.5">
          {EXPLODE_KINDS.map(({ kind, label }) => (
            <Toggle key={kind} label={label} checked={s.explodeOn[kind]} onChange={(checked) => update({ ...s, explodeOn: { ...s.explodeOn, [kind]: checked } })} />
          ))}
        </div>
        <Field label="Emotes per burst">
          <Slider value={s.explodeCount} min={5} max={200} step={5} format={(v) => `${v}`} onChange={(explodeCount) => update({ ...s, explodeCount })} />
        </Field>
      </Group>
    </>
  );
}
