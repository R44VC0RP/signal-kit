"use client";

import { useState } from "react";
import { Toggle } from "@/components/dashboard/overlays/controls";
import { buttonClass, Muted, Section } from "@/components/dashboard/ui";
import type { UserPreferences } from "@/lib/notify/settings";

const inputClass =
  "h-8 w-full rounded-(--r) border border-(--line) bg-(--surface-inset) px-2.5 text-[13px] text-(--text) outline-none placeholder:text-(--text-3) focus:border-(--accent)";

/** Discord notifications and the public stats page. */
export function SettingsForm({ initial, appUrl }: { initial: UserPreferences; appUrl: string }) {
  const [prefs, setPrefs] = useState(initial);
  const [webhook, setWebhook] = useState("");
  const [slug, setSlug] = useState(initial.publicSlug ?? "");
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const save = async (patch: Record<string, unknown>, success?: string) => {
    setMessage(null);
    const response = await fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) }).catch(() => null);
    const json = (await response?.json().catch(() => null)) as { preferences?: UserPreferences; error?: string } | null;
    if (json?.preferences) {
      setPrefs(json.preferences);
      if (success) {
        setMessage({ tone: "ok", text: success });
      }
      return true;
    }
    setMessage({ tone: "error", text: json?.error ?? "Couldn't save." });
    return false;
  };

  const test = async () => {
    setMessage(null);
    const response = await fetch("/api/settings/discord-test", { method: "POST" }).catch(() => null);
    const json = (await response?.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    setMessage(json?.ok ? { tone: "ok", text: "Sent. Check your Discord channel." } : { tone: "error", text: json?.error ?? "Couldn't send." });
  };

  return (
    <>
      {message ? <p className={`-mt-6 text-[13px] ${message.tone === "ok" ? "text-(--onair)" : "text-(--danger-text)"}`}>{message.text}</p> : null}
      <Section title="Discord" aside={<Muted>{prefs.discordWebhookSet ? "Connected" : "Post to your server when you go live"}</Muted>}>
        <div className="flex flex-col gap-4 border-t border-(--line) pt-4">
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-medium text-(--text)">Webhook URL</span>
            <div className="flex gap-2">
              <input
                type="password"
                autoComplete="off"
                className={inputClass}
                value={webhook}
                placeholder={prefs.discordWebhookSet ? "Saved. Paste a new one to replace it." : "https://discord.com/api/webhooks/…"}
                onChange={(event) => setWebhook(event.target.value)}
              />
              <button
                type="button"
                className={buttonClass("primary")}
                disabled={!webhook.trim()}
                onClick={async () => {
                  if (await save({ discordWebhook: webhook }, "Webhook saved.")) {
                    setWebhook("");
                  }
                }}
              >
                Save
              </button>
            </div>
            <span className="text-xs leading-[18px] text-(--text-3)">In Discord: Server Settings → Integrations → Webhooks → New Webhook, pick the channel, then Copy Webhook URL. It&apos;s stored encrypted.</span>
          </div>
          {prefs.discordWebhookSet ? (
            <>
              <div className="flex max-w-120 flex-col gap-2.5">
                <Toggle label="Post when I go live (with links to each platform)" checked={prefs.discordLive} onChange={(discordLive) => void save({ discordLive })} />
                <Toggle label="Post a recap when the stream ends" checked={prefs.discordRecap} onChange={(discordRecap) => void save({ discordRecap })} />
              </div>
              <div className="flex gap-2">
                <button type="button" className={buttonClass("control")} onClick={() => void test()}>
                  Send test
                </button>
                <button type="button" className={buttonClass("quiet")} onClick={() => void save({ discordWebhook: "" }, "Discord disconnected.")}>
                  Remove webhook
                </button>
              </div>
            </>
          ) : null}
        </div>
      </Section>

      <Section title="Public stats page" aside={<Muted>{prefs.publicSlug ? "On" : "Off"}</Muted>}>
        <div className="flex flex-col gap-3 border-t border-(--line) pt-4">
          <span className="text-[13px] text-(--text-2)">A page anyone can open with your recent streams, chat leaderboard and top emotes. Nothing private: no tips by name, no tokens.</span>
          <div className="flex items-center gap-2">
            <span className="sk-mono shrink-0 text-xs text-(--text-3)">{appUrl.replace(/^https?:\/\//, "")}/s/</span>
            <input className={`${inputClass} sk-mono max-w-60`} value={slug} maxLength={40} placeholder="your-name" onChange={(event) => setSlug(event.target.value.toLowerCase())} />
            <button type="button" className={buttonClass("primary")} disabled={!slug.trim() || slug === prefs.publicSlug} onClick={() => void save({ publicSlug: slug }, "Public page is on.")}>
              {prefs.publicSlug ? "Change" : "Turn on"}
            </button>
            {prefs.publicSlug ? (
              <>
                <a href={`/s/${prefs.publicSlug}`} target="_blank" rel="noreferrer" className={buttonClass("control")}>
                  Open
                </a>
                <button
                  type="button"
                  className={buttonClass("quiet")}
                  onClick={async () => {
                    if (await save({ publicSlug: null }, "Public page is off.")) {
                      setSlug("");
                    }
                  }}
                >
                  Turn off
                </button>
              </>
            ) : null}
          </div>
        </div>
      </Section>
    </>
  );
}
