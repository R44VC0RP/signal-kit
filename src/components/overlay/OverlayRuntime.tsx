"use client";

import { useEffect, useState } from "react";
import type { SignalKitEvent } from "@/lib/events/types";
import type { AnySettings, OverlayType } from "@/lib/overlays/settings";
import type { PublicLiveTools } from "@/lib/live/types";
import type { PublicStats } from "@/lib/overlays/stats-core";
import type { CreditsData, LiveSnapshot } from "@/lib/streams/summary";
import { OverlayRenderer, type OverlayEvent } from "./Overlays";

const MAX_EVENTS = 200;

/**
 * Live overlay in OBS: connects with its URL token, renders incoming events, and applies
 * settings saved in the dashboard immediately. Reconnects with backoff; a closed URL (reset or
 * deleted) stops retrying.
 */
export function OverlayRuntime({ token, overlayId, type, initialSettings }: { token: string; overlayId: string; type: OverlayType; initialSettings: AnySettings }) {
  const [settings, setSettings] = useState(initialSettings);
  const [events, setEvents] = useState<OverlayEvent[]>([]);
  const [history, setHistory] = useState<OverlayEvent[]>([]);
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [tools, setTools] = useState<PublicLiveTools | null>(null);
  const [stream, setStream] = useState<LiveSnapshot | null>(null);
  const [credits, setCredits] = useState<CreditsData | null>(null);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    let stopped = false;

    const connect = () => {
      ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws?overlay=${encodeURIComponent(token)}`);
      ws.onmessage = (message) => {
        let parsed:
          | (Partial<SignalKitEvent> & { type?: string; settings?: AnySettings; stats?: PublicStats; history?: SignalKitEvent[]; tools?: PublicLiveTools; stream?: LiveSnapshot; credits?: CreditsData | null })
          | null = null;
        try {
          parsed = JSON.parse(String(message.data));
        } catch {
          return;
        }
        if (!parsed) {
          return;
        }
        if (parsed.type === "signal_kit.ready") {
          attempt = 0;
          return;
        }
        if (parsed.type === "signal_kit.overlay.settings" && parsed.settings) {
          setSettings(parsed.settings);
          return;
        }
        // On connect: current goal/label stats and recent events (lists show them; alerts don't replay them).
        if (parsed.type === "signal_kit.overlay.init") {
          if (parsed.stats) {
            setStats(parsed.stats);
          }
          setHistory(Array.isArray(parsed.history) ? parsed.history : []);
          setTools(parsed.tools ?? null);
          setStream(parsed.stream ?? null);
          setCredits(parsed.credits ?? null);
          return;
        }
        if (parsed.type === "signal_kit.overlay.live_tools" && parsed.tools) {
          setTools(parsed.tools);
          return;
        }
        if (parsed.type === "signal_kit.overlay.stream" && parsed.stream) {
          setStream(parsed.stream);
          return;
        }
        if (parsed.type === "signal_kit.overlay.stats" && parsed.stats) {
          setStats(parsed.stats);
          return;
        }
        if (parsed.v === 2 && parsed.id && parsed.kind) {
          const event: OverlayEvent = { ...(parsed as SignalKitEvent), seenAt: Date.now() };
          setEvents((current) => (current.some((existing) => existing.id === event.id) ? current : [...current, event].slice(-MAX_EVENTS)));
        }
      };
      ws.onclose = (event) => {
        if (stopped) {
          return;
        }
        if (event.code === 1008) {
          setGone(true);
          return;
        }
        const delay = Math.min(30_000, 1000 * 2 ** attempt) + Math.random() * 500;
        attempt += 1;
        retry = setTimeout(connect, delay);
      };
    };
    connect();
    return () => {
      stopped = true;
      clearTimeout(retry);
      ws?.close();
    };
  }, [token]);

  if (gone) {
    return (
      <p style={{ margin: 24, font: "500 16px system-ui", color: "#f5f5f5", textShadow: "0 1px 3px #000" }}>
        This overlay URL no longer works. Copy the current URL from your Signal Kit dashboard.
      </p>
    );
  }
  return <OverlayRenderer type={type} settings={settings} events={events} history={history} stats={stats} overlayId={overlayId} tools={tools} stream={stream} credits={credits} />;
}
