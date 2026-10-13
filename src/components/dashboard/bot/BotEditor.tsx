"use client";

import { useEffect, useRef, useState } from "react";
import { ConnectButton } from "@/components/AuthButtons";
import { Field, NumberField, SelectField, Slider, TextField, Toggle } from "@/components/dashboard/overlays/controls";
import { PlatformLogo } from "@/components/dashboard/PlatformLogo";
import { buttonClass, Muted, Section } from "@/components/dashboard/ui";
import { BUILTINS, commandName, ROLE_LABEL, ROLES, type BotConfig, type Role } from "@/lib/bot/config";

type Context = {
  twitch: { name: string; status: string; missingScopes: string[] } | null;
  bots: { id: string; name: string; status: string }[];
};

const TABS = ["Commands", "Timers", "Moderation", "Loyalty", "Quotes & markers"] as const;
const roleOptions = ROLES.map((role) => ({ value: role, label: ROLE_LABEL[role] }));
const newId = () => Math.random().toString(36).slice(2, 10);
const inputClass =
  "h-8 w-full rounded-(--r) border border-(--line) bg-(--surface-inset) px-2.5 text-[13px] text-(--text) outline-none placeholder:text-(--text-3) focus:border-(--accent)";

/** The chat bot: commands, timers, spam filters, loyalty points and stream markers. Autosaves. */
export function BotEditor({ initial, context: initialContext }: { initial: BotConfig; context: Context }) {
  const [config, setConfig] = useState(initial);
  const [context, setContext] = useState(initialContext);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Commands");
  const [save, setSave] = useState<"saved" | "saving" | "error">("saved");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const update = (next: BotConfig) => {
    setConfig(next);
    setSave("saving");
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const response = await fetch("/api/bot", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ config: next }) }).catch(() => null);
      if (!response?.ok) {
        setSave("error");
        return;
      }
      const json = (await response.json()) as { config: BotConfig } & Context;
      setContext({ twitch: json.twitch, bots: json.bots });
      setSave("saved");
    }, 600);
  };

  const missing = context.twitch?.missingScopes ?? [];
  return (
    <>
      <div className="-mt-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-32">
            <Toggle label={config.enabled ? "Bot is on" : "Bot is off"} checked={config.enabled} onChange={(enabled) => update({ ...config, enabled })} />
          </div>
          {context.twitch ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-(--text-3)">
              <PlatformLogo platform="twitch" size={12} /> {context.twitch.name}
            </span>
          ) : null}
        </div>
        <span className="text-xs text-(--text-3)">{save === "saved" ? "All changes saved" : save === "saving" ? "Saving…" : "Couldn't save"}</span>
      </div>

      {!context.twitch ? (
        <Notice title="Connect Twitch to use the bot">
          The bot answers in Twitch chat. Loyalty points also count chat from YouTube and X once Twitch is connected.
          <ConnectButton provider="twitch" mode="link" className={buttonClass("primary")}>
            Connect Twitch
          </ConnectButton>
        </Notice>
      ) : missing.length ? (
        <Notice title="Reconnect Twitch to allow moderation, shoutouts, clips and markers">
          Signal Kit now needs permission to delete spam and time out users, send shoutouts, make clips and add stream markers. Commands, timers and points already work.
          <ConnectButton provider="twitch" mode="link" className={buttonClass("primary")}>
            Reconnect Twitch
          </ConnectButton>
        </Notice>
      ) : null}

      <Section title="Who speaks">
        <div className="flex flex-col gap-2 border-t border-(--line) pt-4">
          <div className="max-w-80">
            <SelectField
              value={config.sender}
              options={[{ value: "broadcaster", label: `Your channel${context.twitch ? ` (${context.twitch.name})` : ""}` }, ...context.bots.map((bot) => ({ value: bot.id, label: `Bot account: ${bot.name}` }))]}
              onChange={(sender) => update({ ...config, sender })}
            />
          </div>
          <span className="text-xs leading-[18px] text-(--text-3)">
            Messages show Twitch&apos;s Chat Bot badge. To reply from a separate account, connect it as a bot on Connections and make it a moderator in your channel (/mod name).
          </span>
        </div>
      </Section>

      <div className="flex gap-1 border-b border-(--line)">
        {TABS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={`-mb-px border-b-2 px-3 pb-2.5 text-[13px] ${item === tab ? "border-(--accent) font-medium text-(--text)" : "border-transparent text-(--text-3) hover:text-(--text)"}`}
          >
            {item}
          </button>
        ))}
      </div>

      {tab === "Commands" ? <Commands config={config} update={update} /> : null}
      {tab === "Timers" ? <Timers config={config} update={update} /> : null}
      {tab === "Moderation" ? <Moderation config={config} update={update} /> : null}
      {tab === "Loyalty" ? <Loyalty config={config} update={update} /> : null}
      {tab === "Quotes & markers" ? <QuotesMarkers config={config} update={update} /> : null}
    </>
  );
}

type Props = { config: BotConfig; update: (next: BotConfig) => void };

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  const parts = Array.isArray(children) ? children : [children];
  return (
    <div className="flex items-center gap-4 border-y border-(--line) py-4">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-[13px] font-semibold text-(--text)">{title}</span>
        <span className="text-xs leading-[18px] text-(--text-3)">{parts[0]}</span>
      </div>
      {parts.slice(1)}
    </div>
  );
}

function Commands({ config, update }: Props) {
  const set = (id: string, patch: Partial<BotConfig["commands"][number]>) => update({ ...config, commands: config.commands.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
  return (
    <>
      <Section title="Your commands" aside={<Muted>{"Variables: {user} {target} {args} {count} {uptime} {points} {pointsname} {random:1-100}"}</Muted>}>
        <div className="sk-mono grid grid-cols-[150px_1fr_130px_70px_44px] gap-2 border-t border-(--line) py-2 text-[11px] tracking-[0.04em] text-(--text-3) uppercase">
          <span>Command</span>
          <span>Response</span>
          <span>Who</span>
          <span>Cooldown</span>
          <span />
        </div>
        {config.commands.map((command) => (
          <div key={command.id} className="grid grid-cols-[150px_1fr_130px_70px_44px] items-center gap-2 border-t border-(--line) py-2">
            <div className="flex items-center gap-1">
              <span className="sk-mono text-xs text-(--text-3)">!</span>
              <input className={`${inputClass} sk-mono`} value={command.name} onChange={(event) => set(command.id, { name: commandName(event.target.value) })} />
            </div>
            <input className={inputClass} value={command.response} maxLength={450} onChange={(event) => set(command.id, { response: event.target.value })} />
            <SelectField value={command.permission} options={roleOptions} onChange={(permission: Role) => set(command.id, { permission })} />
            <NumberField value={command.cooldownSec} onChange={(cooldownSec) => set(command.id, { cooldownSec })} max={3600} suffix="s" />
            <button type="button" aria-label={`Delete !${command.name}`} className={buttonClass("quiet")} onClick={() => update({ ...config, commands: config.commands.filter((c) => c.id !== command.id) })}>
              ✕
            </button>
          </div>
        ))}
        <div className="border-t border-(--line) pt-3">
          <button
            type="button"
            className={buttonClass("control")}
            onClick={() => update({ ...config, commands: [...config.commands, { id: newId(), name: `command${config.commands.length + 1}`, response: "", permission: "everyone", cooldownSec: 5, userCooldownSec: 0, enabled: true, uses: 0 }] })}
          >
            Add command
          </button>
        </div>
      </Section>
      <Section title="Built-in commands">
        <div className="grid grid-cols-2 gap-x-10 gap-y-2.5 border-t border-(--line) pt-4">
          {BUILTINS.map(([key, usage, description]) => (
            <Toggle key={key} label={`${usage}: ${description}`} checked={config.builtins[key]} onChange={(on) => update({ ...config, builtins: { ...config.builtins, [key]: on } })} />
          ))}
        </div>
        <div className="mt-4 max-w-80">
          <Field label="Who can use !clip">
            <SelectField value={config.clipPermission} options={roleOptions} onChange={(clipPermission: Role) => update({ ...config, clipPermission })} />
          </Field>
        </div>
      </Section>
    </>
  );
}

function Timers({ config, update }: Props) {
  const set = (id: string, patch: Partial<BotConfig["timers"][number]>) => update({ ...config, timers: config.timers.map((t) => (t.id === id ? { ...t, ...patch } : t)) });
  return (
    <Section title="Timed messages" aside={<Muted>Only while you&apos;re live, and only once enough people have chatted</Muted>}>
      {config.timers.map((timer) => (
        <div key={timer.id} className="grid grid-cols-[1fr_120px_120px_70px_44px] items-center gap-2 border-t border-(--line) py-2.5">
          <input className={inputClass} value={timer.message} maxLength={450} placeholder="Message" onChange={(event) => set(timer.id, { message: event.target.value })} />
          <NumberField value={timer.intervalMin} onChange={(intervalMin) => set(timer.id, { intervalMin })} min={5} max={240} suffix="min" />
          <NumberField value={timer.minLines} onChange={(minLines) => set(timer.id, { minLines })} max={500} suffix="lines" />
          <Toggle label="" checked={timer.enabled} onChange={(enabled) => set(timer.id, { enabled })} />
          <button type="button" aria-label="Delete timer" className={buttonClass("quiet")} onClick={() => update({ ...config, timers: config.timers.filter((t) => t.id !== timer.id) })}>
            ✕
          </button>
        </div>
      ))}
      <div className="border-t border-(--line) pt-3">
        <button type="button" className={buttonClass("control")} onClick={() => update({ ...config, timers: [...config.timers, { id: newId(), message: "", intervalMin: 15, minLines: 5, enabled: true }] })}>
          Add timed message
        </button>
      </div>
    </Section>
  );
}

function Moderation({ config, update }: Props) {
  const m = config.moderation;
  const set = (patch: Partial<BotConfig["moderation"]>) => update({ ...config, moderation: { ...m, ...patch } });
  return (
    <Section title="Spam filters" aside={<Muted>Twitch chat; needs the moderation permission</Muted>}>
      <div className="grid grid-cols-2 gap-10 border-t border-(--line) pt-4">
        <div className="flex flex-col gap-3">
          <Toggle label="Filter spam" checked={m.enabled} onChange={(enabled) => set({ enabled })} />
          <Toggle label="Links" checked={m.links} onChange={(links) => set({ links })} />
          <Toggle label="Too many caps" checked={m.caps} onChange={(caps) => set({ caps })} />
          {m.caps ? (
            <Field label="Caps limit">
              <Slider value={m.capsPercent} min={30} max={100} step={5} format={(v) => `${v}%`} onChange={(capsPercent) => set({ capsPercent })} />
            </Field>
          ) : null}
          <Toggle label="Symbol spam" checked={m.symbols} onChange={(symbols) => set({ symbols })} />
          <Toggle label="Emote spam" checked={m.emotes} onChange={(emotes) => set({ emotes })} />
          {m.emotes ? (
            <Field label="Most emotes per message">
              <Slider value={m.maxEmotes} min={3} max={50} step={1} format={(v) => `${v}`} onChange={(maxEmotes) => set({ maxEmotes })} />
            </Field>
          ) : null}
          <Toggle label="Very long messages" checked={m.length} onChange={(length) => set({ length })} />
          {m.length ? (
            <Field label="Longest message">
              <Slider value={m.maxLength} min={100} max={500} step={10} format={(v) => `${v}`} onChange={(maxLength) => set({ maxLength })} />
            </Field>
          ) : null}
        </div>
        <div className="flex flex-col gap-4">
          <Field label="Blocked words and phrases" hint="One per line">
            <textarea
              value={m.words}
              rows={5}
              maxLength={4000}
              onChange={(event) => set({ words: event.target.value })}
              className="w-full resize-y rounded-(--r) border border-(--line) bg-(--surface-inset) p-2.5 text-[13px] leading-5 text-(--text) outline-none focus:border-(--accent)"
            />
          </Field>
          <Field label="What to do">
            <SelectField
              value={m.action}
              options={[
                { value: "delete", label: "Delete the message" },
                { value: "timeout", label: "Time the user out" },
              ]}
              onChange={(action: "delete" | "timeout") => set({ action })}
            />
          </Field>
          {m.action === "timeout" ? (
            <Field label="Timeout length">
              <NumberField value={m.timeoutSec} onChange={(timeoutSec) => set({ timeoutSec })} min={1} max={1_209_600} suffix="seconds" />
            </Field>
          ) : null}
          <Toggle label="Explain in chat (once per 30 s per person)" checked={m.warn} onChange={(warn) => set({ warn })} />
          <Field label="Never filter">
            <SelectField value={m.exempt} options={roleOptions.filter((r) => r.value !== "everyone").map((r) => ({ ...r, label: `${r.label} and up` }))} onChange={(exempt: Role) => set({ exempt })} />
          </Field>
        </div>
      </div>
    </Section>
  );
}

function Loyalty({ config, update }: Props) {
  const l = config.loyalty;
  const set = (patch: Partial<BotConfig["loyalty"]>) => update({ ...config, loyalty: { ...l, ...patch } });
  const [board, setBoard] = useState<{ platform: "twitch" | "youtube" | "x"; name: string; points: number; watchMinutes: number }[] | null>(null);
  useEffect(() => {
    const load = setTimeout(async () => {
      const response = await fetch("/api/bot/loyalty").catch(() => null);
      setBoard(((await response?.json().catch(() => null)) as { leaderboard?: typeof board } | null)?.leaderboard ?? []);
    }, 0);
    return () => clearTimeout(load);
  }, []);
  return (
    <>
      <Section title="Loyalty points" aside={<Muted>Earned on Twitch, YouTube and X</Muted>}>
        <div className="grid grid-cols-2 gap-10 border-t border-(--line) pt-4">
          <div className="flex flex-col gap-3">
            <Toggle label="Give points" checked={l.enabled} onChange={(enabled) => set({ enabled })} />
            <Field label="Call them">
              <TextField value={l.name} onChange={(name) => set({ name })} maxLength={24} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Per chat message">
                <NumberField value={l.perMessage} onChange={(perMessage) => set({ perMessage })} max={1000} />
              </Field>
              <Field label="At most every">
                <NumberField value={l.messageCooldownSec} onChange={(messageCooldownSec) => set({ messageCooldownSec })} max={3600} suffix="s" />
              </Field>
            </div>
            <Field label="Per minute watching" hint="Twitch, checked every 5 min">
              <NumberField value={l.perMinute} onChange={(perMinute) => set({ perMinute })} max={1000} />
            </Field>
          </div>
          <div className="flex flex-col gap-3">
            <span className="text-[13px] font-medium text-(--text)">Bonuses</span>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Follow">
                <NumberField value={l.bonusFollow} onChange={(bonusFollow) => set({ bonusFollow })} max={1e6} />
              </Field>
              <Field label="Sub (each gifted too)">
                <NumberField value={l.bonusSub} onChange={(bonusSub) => set({ bonusSub })} max={1e6} />
              </Field>
              <Field label="Per 100 bits">
                <NumberField value={l.bonusCheer} onChange={(bonusCheer) => set({ bonusCheer })} max={1e6} />
              </Field>
              <Field label="Raid">
                <NumberField value={l.bonusRaid} onChange={(bonusRaid) => set({ bonusRaid })} max={1e6} />
              </Field>
            </div>
          </div>
        </div>
      </Section>
      <Section title="Store" aside={<Muted>Viewers type !redeem name; it shows in your alert box, and a wheel set to the same name spins</Muted>}>
        {l.store.map((item) => (
          <div key={item.id} className="grid grid-cols-[1fr_140px_70px_44px] items-center gap-2 border-t border-(--line) py-2">
            <input className={inputClass} value={item.name} maxLength={60} onChange={(event) => set({ store: l.store.map((s) => (s.id === item.id ? { ...s, name: event.target.value } : s)) })} />
            <NumberField value={item.cost} onChange={(cost) => set({ store: l.store.map((s) => (s.id === item.id ? { ...s, cost } : s)) })} min={1} max={1e9} suffix={l.name} />
            <Toggle label="" checked={item.enabled} onChange={(enabled) => set({ store: l.store.map((s) => (s.id === item.id ? { ...s, enabled } : s)) })} />
            <button type="button" aria-label="Delete item" className={buttonClass("quiet")} onClick={() => set({ store: l.store.filter((s) => s.id !== item.id) })}>
              ✕
            </button>
          </div>
        ))}
        <div className="border-t border-(--line) pt-3">
          <button type="button" className={buttonClass("control")} onClick={() => set({ store: [...l.store, { id: newId(), name: "New reward", cost: 500, enabled: true }] })}>
            Add reward
          </button>
        </div>
      </Section>
      <Section title="Leaderboard">
        {board === null ? <Muted>Loading…</Muted> : null}
        {board?.length === 0 ? (
          <div className="border-t border-(--line) py-4">
            <Muted>No points yet. They start counting once the bot is on.</Muted>
          </div>
        ) : null}
        {board?.slice(0, 20).map((row, index) => (
          <div key={`${row.platform}${row.name}`} className="flex min-h-10 items-center gap-3 border-t border-(--line)">
            <span className="sk-mono w-6 text-xs text-(--text-3)">{index + 1}</span>
            <PlatformLogo platform={row.platform} size={12} />
            <span className="flex-1 truncate text-[13px] text-(--text)">{row.name}</span>
            <span className="sk-mono w-28 text-right text-xs text-(--text-3)">{`${Math.round(row.watchMinutes / 60)}h watched`}</span>
            <span className="sk-mono w-28 text-right text-xs text-(--text)">{row.points.toLocaleString("en")}</span>
          </div>
        ))}
      </Section>
    </>
  );
}

function QuotesMarkers({ config, update }: Props) {
  const mk = config.markers;
  const setMarkers = (patch: Partial<BotConfig["markers"]>) => update({ ...config, markers: { ...mk, ...patch } });
  const [quote, setQuote] = useState("");
  return (
    <>
      <Section title="Automatic stream markers" aside={<Muted>So big moments are easy to find when you clip your VOD</Muted>}>
        <div className="grid max-w-160 grid-cols-2 gap-x-10 gap-y-3 border-t border-(--line) pt-4">
          <Toggle label="Add markers" checked={mk.enabled} onChange={(enabled) => setMarkers({ enabled })} />
          <span />
          <Toggle label="Raids" checked={mk.raid} onChange={(raid) => setMarkers({ raid })} />
          <Toggle label="Hype train starts" checked={mk.hypeTrain} onChange={(hypeTrain) => setMarkers({ hypeTrain })} />
          <Field label="Gift subs, at least">
            <NumberField value={mk.giftMin} onChange={(giftMin) => setMarkers({ giftMin })} max={1000} suffix="subs (0 = off)" />
          </Field>
          <Field label="Cheers, at least">
            <NumberField value={mk.cheerMin} onChange={(cheerMin) => setMarkers({ cheerMin })} max={1_000_000} suffix="bits (0 = off)" />
          </Field>
        </div>
      </Section>
      <Section title="Quotes" aside={<Muted>!quote shows one; moderators use !addquote and !delquote</Muted>}>
        {config.quotes.map((item) => (
          <div key={item.id} className="flex min-h-10 items-center gap-3 border-t border-(--line)">
            <span className="sk-mono w-8 text-xs text-(--text-3)">#{item.id}</span>
            <span className="flex-1 truncate text-[13px] text-(--text-2)">{item.text}</span>
            <span className="text-xs text-(--text-3)">{item.by}</span>
            <button type="button" aria-label={`Delete quote ${item.id}`} className={buttonClass("quiet")} onClick={() => update({ ...config, quotes: config.quotes.filter((q) => q.id !== item.id) })}>
              ✕
            </button>
          </div>
        ))}
        <div className="flex gap-2 border-t border-(--line) pt-3">
          <input className={inputClass} value={quote} maxLength={300} placeholder="Add a quote" onChange={(event) => setQuote(event.target.value)} />
          <button
            type="button"
            className={buttonClass("control")}
            disabled={!quote.trim()}
            onClick={() => {
              update({ ...config, quotes: [...config.quotes, { id: Math.max(0, ...config.quotes.map((q) => q.id)) + 1, text: quote.trim(), by: "", at: new Date().toISOString() }] });
              setQuote("");
            }}
          >
            Add
          </button>
        </div>
      </Section>
    </>
  );
}
