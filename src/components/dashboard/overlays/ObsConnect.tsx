"use client";

import { useState } from "react";
import { buttonClass } from "@/components/dashboard/ui";
import { ObsClient, saveObsSettings, savedObsSettings, type ObsSource } from "@/lib/obs/client";
import { SelectField, TextField } from "./controls";

const NEW_SCENE = "\u0000new";

/**
 * One-click setup: connects to OBS on this computer (obs-websocket, built into OBS 28+) and
 * creates the browser sources, sized and placed, in the scene you pick.
 */
export function ObsConnect({ sources, label = "Add to OBS automatically" }: { sources: ObsSource[]; label?: string }) {
  const [step, setStep] = useState<"idle" | "connecting" | "settings" | "pick" | "adding" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(() => (typeof window === "undefined" ? { url: "ws://127.0.0.1:4455", password: "" } : savedObsSettings()));
  const [client, setClient] = useState<ObsClient | null>(null);
  const [scenes, setScenes] = useState<string[]>([]);
  const [scene, setScene] = useState("");
  const [result, setResult] = useState("");

  const connect = async (settings = form) => {
    setStep("connecting");
    setError(null);
    const obs = new ObsClient();
    try {
      await obs.connect(settings.url, settings.password);
      saveObsSettings(settings);
      const list = await obs.scenes();
      setClient(obs);
      setScenes(list.names);
      setScene(list.current);
      setStep("pick");
    } catch (failure) {
      obs.close();
      setError((failure as Error).message);
      setStep("settings");
    }
  };

  const add = async () => {
    if (!client) {
      return;
    }
    setStep("adding");
    setError(null);
    try {
      let target = scene;
      if (scene === NEW_SCENE) {
        target = "Signal Kit";
        await client.createScene(target);
      }
      for (const source of sources) {
        await client.addBrowserSource(target, source);
      }
      setResult(sources.length === 1 ? `Added “${sources[0].name}” to ${target}.` : `Added ${sources.length} overlays to ${target}.`);
      setStep("done");
      client.close();
      setClient(null);
    } catch (failure) {
      setError((failure as Error).message);
      setStep("pick");
    }
  };

  if (step === "idle" || step === "connecting") {
    return (
      <div className="flex flex-col gap-2">
        <button type="button" className={`${buttonClass("primary")} self-start`} disabled={step === "connecting"} onClick={() => void connect()}>
          {step === "connecting" ? "Connecting to OBS…" : label}
        </button>
        <span className="text-xs leading-[18px] text-(--text-3)">Needs OBS 28 or newer open on this computer. Your browser may ask to allow access to local devices.</span>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className="flex items-center gap-3 text-[13px] text-(--text-2)">
        <span className="size-2 rounded-full bg-(--onair)" />
        <span className="flex-1">{result}</span>
        <button type="button" className={buttonClass("quiet")} onClick={() => setStep("idle")}>
          Again
        </button>
      </div>
    );
  }

  if (step === "settings") {
    return (
      <div className="flex flex-col gap-3 rounded-(--r) border border-(--line) p-3.5">
        {error ? <p className="text-xs leading-[18px] text-(--danger-text)">{error}</p> : null}
        <ol className="flex list-decimal flex-col gap-1 pl-4 text-xs leading-[18px] text-(--text-3)">
          <li>In OBS, open Tools → WebSocket Server Settings.</li>
          <li>Tick “Enable WebSocket server”, then “Show Connect Info”.</li>
          <li>Copy the server password here.</li>
        </ol>
        <div className="grid grid-cols-[1fr_1fr] gap-2">
          <TextField value={form.url} onChange={(url) => setForm({ ...form, url: url.trim() })} placeholder="ws://127.0.0.1:4455" mono />
          <input
            type="password"
            value={form.password}
            placeholder="Server password"
            autoComplete="off"
            onChange={(event) => setForm({ ...form, password: event.target.value })}
            className="h-8 w-full rounded-(--r) border border-(--line) bg-(--surface-inset) px-2.5 text-[13px] text-(--text) outline-none placeholder:text-(--text-3) focus:border-(--accent)"
          />
        </div>
        <div className="flex gap-2">
          <button type="button" className={buttonClass("primary")} onClick={() => void connect(form)}>
            Connect
          </button>
          <button type="button" className={buttonClass("quiet")} onClick={() => setStep("idle")}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-(--r) border border-(--line) p-3.5">
      <span className="text-[13px] font-medium text-(--text)">Connected to OBS</span>
      {error ? <p className="text-xs text-(--danger-text)">{error}</p> : null}
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <SelectField value={scene} options={[...scenes.map((name) => ({ value: name, label: name })), { value: NEW_SCENE, label: "New scene: Signal Kit" }]} onChange={setScene} />
        </div>
        <button type="button" className={buttonClass("primary")} disabled={step === "adding"} onClick={() => void add()}>
          {step === "adding" ? "Adding…" : sources.length === 1 ? "Add to scene" : `Add ${sources.length} overlays`}
        </button>
      </div>
      <span className="text-xs text-(--text-3)">Running this again updates the existing sources instead of adding copies.</span>
    </div>
  );
}
