"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { buttonClass } from "./ui";

async function send(url: string, init: RequestInit) {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init.headers } });
  const payload = (await response.json().catch(() => ({}))) as { error?: string; key?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? "Something went wrong.");
  }
  return payload;
}

function useAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function run(action: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
      }
    });
  }
  return { pending, error, run };
}

function ErrorText({ error }: { error: string | null }) {
  return error ? <span className="text-xs text-(--danger-text)">{error}</span> : null;
}

export function RevokeKeyButton({ id, name }: { id: string; name: string }) {
  const { pending, error, run } = useAction();
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        className={buttonClass("quiet")}
        onClick={() => {
          if (window.confirm(`Revoke "${name}"? Anything using it disconnects immediately.`)) {
            run(() => send(`/api/keys/${id}`, { method: "DELETE" }));
          }
        }}
      >
        {pending ? "Revoking…" : "Revoke"}
      </button>
      <ErrorText error={error} />
    </span>
  );
}

export function DisconnectButton({ id, name, platform }: { id: string; name: string; platform?: string }) {
  const { pending, error, run } = useAction();
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        className={buttonClass("quiet")}
        onClick={() => {
          const message =
            platform === "youtube"
              ? `Disconnect ${name}? Disconnecting deletes everything Signal Kit stored from YouTube for this channel. It doesn't change anything on YouTube.`
              : `Disconnect ${name}? Signal Kit stops listening to it and revokes its access.`;
          if (window.confirm(message)) {
            run(() => send(`/api/connections/${id}`, { method: "DELETE" }));
          }
        }}
      >
        {pending ? "Disconnecting…" : "Disconnect"}
      </button>
      <ErrorText error={error} />
    </span>
  );
}

export function RoleToggle({ id, role }: { id: string; role: "broadcaster" | "bot" }) {
  const { pending, error, run } = useAction();
  const options = [
    { value: "broadcaster", label: "Channel" },
    { value: "bot", label: "Bot" },
  ] as const;
  return (
    <span className="inline-flex flex-col gap-1">
      <span role="radiogroup" aria-label="Role" className="inline-flex rounded-(--r) border border-(--line) bg-(--surface-inset) p-0.5">
        {options.map((option) => {
          const active = option.value === role;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={pending || active}
              onClick={() => run(() => send(`/api/connections/${id}`, { method: "PATCH", body: JSON.stringify({ role: option.value }) }))}
              className={`h-5.5 rounded-[4px] px-2.5 text-xs font-medium ${
                active ? "sk-grain bg-(--control) text-(--text)" : "text-(--text-3) hover:text-(--text)"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </span>
      <ErrorText error={error} />
    </span>
  );
}

export function CopyButton({ value, label = "Copy", kind = "control" }: { value: string; label?: string; kind?: "control" | "primary" }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={buttonClass(kind)}
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? "Copied" : label}
    </button>
  );
}

export function CreateKeyForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [created, setCreated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const payload = await send("/api/keys", { method: "POST", body: JSON.stringify({ name: name.trim() || "API key" }) });
        setCreated(payload.key ?? null);
        setName("");
        router.refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={submit} className="flex items-center gap-2">
        <label htmlFor="key-name" className="sr-only">
          Key name
        </label>
        <input
          id="key-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Name it after what uses it, e.g. Stream overlay"
          maxLength={120}
          className="h-7 w-90 rounded-(--r) border border-(--line-strong) bg-(--surface-inset) px-2.5 text-[13px] text-(--text) placeholder:text-(--text-3) hover:border-[#444] focus:border-(--accent) focus:outline-none"
        />
        <button type="submit" disabled={pending} className={buttonClass("primary")}>
          {pending ? "Creating…" : "Create key"}
        </button>
        <ErrorText error={error} />
      </form>
      {created ? (
        <div className="flex flex-col gap-2.5 rounded-(--r) border border-[rgb(61_107_255/35%)] bg-(--accent-soft) px-4 py-3.5">
          <p className="text-[13px] font-medium text-(--text)">Copy your new key now. You won&apos;t be able to see it again.</p>
          <div className="flex items-center gap-2">
            <code className="sk-mono flex h-7.5 flex-1 items-center overflow-x-auto rounded-(--r) bg-(--surface-inset) px-2.5 text-xs whitespace-nowrap text-(--text)">
              {created}
            </code>
            <CopyButton value={created} kind="primary" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
