"use client";

import type { ReactNode } from "react";

/** Small form controls for the overlay customizer, in the dashboard's Console style. */

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-medium text-(--text)">{label}</span>
        {hint ? <span className="text-xs text-(--text-3)">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

export function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-t border-(--line) py-5 first:border-t-0 first:pt-0">
      <h3 className="sk-mono text-[11px] tracking-[0.06em] text-(--text-3) uppercase">{title}</h3>
      {children}
    </section>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (value: T) => void }) {
  return (
    <div role="radiogroup" className="flex rounded-(--r) border border-(--line) bg-(--surface-inset) p-0.5">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={`h-7 flex-1 rounded-[4px] px-2.5 text-xs font-medium transition-colors ${
              active ? "sk-grain bg-(--control) text-(--text)" : "text-(--text-3) hover:text-(--text)"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({ label, checked, onChange, children }: { label: string; checked: boolean; onChange: (checked: boolean) => void; children?: ReactNode }) {
  // A row you can click anywhere on. Not a <label> around the switch: a label forwards its click
  // to the button inside, which toggled the switch twice and left it unchanged.
  return (
    <div className="flex cursor-pointer items-center gap-3 text-[13px] text-(--text-2)" onClick={() => onChange(!checked)}>
      {children}
      <span className="flex-1 select-none">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={(event) => {
          event.stopPropagation();
          onChange(!checked);
        }}
        className={`relative h-5 w-8.5 shrink-0 rounded-full transition-colors ${checked ? "sk-grain bg-(--accent-fill)" : "bg-(--control)"}`}
      >
        <span className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-[left] ${checked ? "left-4" : "left-0.5"}`} />
      </button>
    </div>
  );
}

export function Slider({
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-1 flex-1 cursor-pointer accent-(--accent)"
      />
      <span className="sk-mono w-14 shrink-0 text-right text-xs text-(--text-2)">{format(value)}</span>
    </div>
  );
}

export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex items-center gap-3 text-[13px] text-(--text-2)">
      <span className="flex-1">{label}</span>
      <span className="sk-mono text-xs text-(--text-3) uppercase">{value}</span>
      <span className="relative size-7 shrink-0 overflow-hidden rounded-(--r) border border-(--line-strong)" style={{ background: value }}>
        <input type="color" value={value} onChange={(event) => onChange(event.target.value)} className="absolute inset-0 size-full cursor-pointer opacity-0" aria-label={label} />
      </span>
    </label>
  );
}

export function TextField({
  value,
  onChange,
  placeholder,
  maxLength = 140,
  mono = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  mono?: boolean;
}) {
  return (
    <input
      value={value}
      maxLength={maxLength}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className={`h-8 w-full rounded-(--r) border border-(--line) bg-(--surface-inset) px-2.5 text-[13px] text-(--text) outline-none placeholder:text-(--text-3) focus:border-(--accent) ${mono ? "sk-mono text-xs" : ""}`}
    />
  );
}

/** Text input plus clickable {variable} chips that insert at the end. */
export function TemplateField({ value, onChange, variables }: { value: string; onChange: (value: string) => void; variables: readonly string[] }) {
  return (
    <div className="flex flex-col gap-2">
      <TextField value={value} onChange={onChange} />
      <div className="flex flex-wrap gap-1">
        {variables.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => onChange(`${value}${value.endsWith(" ") || !value ? "" : " "}{${name}}`.slice(0, 140))}
            className="sk-mono rounded-[4px] border border-(--line) px-1.5 py-0.5 text-[11px] text-(--text-3) hover:border-(--line-strong) hover:text-(--text)"
          >
            {`{${name}}`}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SelectField<T extends string>({ value, options, onChange, fontFor }: { value: T; options: { value: T; label: string }[]; onChange: (value: T) => void; fontFor?: (value: T) => string }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as T)}
      className="h-8 w-full cursor-pointer rounded-(--r) border border-(--line) bg-(--surface-inset) px-2 text-[13px] text-(--text) outline-none focus:border-(--accent)"
      style={fontFor ? { fontFamily: fontFor(value) } : undefined}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value} style={fontFor ? { fontFamily: fontFor(option.value) } : undefined}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

const POSITION_LABELS: Record<string, string> = {
  "top-left": "Top left",
  top: "Top",
  "top-right": "Top right",
  left: "Left",
  center: "Center",
  right: "Right",
  "bottom-left": "Bottom left",
  bottom: "Bottom",
  "bottom-right": "Bottom right",
};

/** Nine-cell picker for where alerts appear on screen. */
export function PositionGrid<T extends string>({ value, onChange }: { value: T; onChange: (value: T) => void }) {
  return (
    <div role="radiogroup" aria-label="Position" className="grid h-[54px] w-21 grid-cols-3 gap-[3px] rounded-[6px] border border-(--line) bg-(--surface-inset) p-1">
      {(Object.keys(POSITION_LABELS) as T[]).map((position) => {
        const active = position === value;
        return (
          <button
            key={position}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={POSITION_LABELS[position]}
            title={POSITION_LABELS[position]}
            onClick={() => onChange(position)}
            className={`rounded-[2px] transition-colors ${active ? "bg-(--accent)" : "bg-[#2a2a2a] hover:bg-[#3a3a3a]"}`}
          />
        );
      })}
    </div>
  );
}
