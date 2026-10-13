/**
 * Talks to OBS Studio from the dashboard over obs-websocket v5 (built into OBS 28+), so
 * "Add to OBS" creates and places the browser sources itself. Runs in the browser: the
 * connection goes straight from the streamer's dashboard tab to OBS on their machine; nothing
 * passes through Signal Kit's server and the password stays in this browser.
 */

type Message = { op: number; d: Record<string, unknown> };

export class ObsError extends Error {
  constructor(
    message: string,
    readonly code?: number,
  ) {
    super(message);
  }
}

export type ObsSource = {
  name: string;
  url: string;
  width: number;
  height: number;
  /** Where on a 1920×1080 canvas; scaled to the real canvas size. */
  x: number;
  y: number;
};

const SETTINGS_KEY = "signalkit.obs";

export function savedObsSettings(): { url: string; password: string } {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") as { url?: string; password?: string };
    return { url: saved.url || "ws://127.0.0.1:4455", password: saved.password ?? "" };
  } catch {
    return { url: "ws://127.0.0.1:4455", password: "" };
  }
}

export function saveObsSettings(settings: { url: string; password: string }) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

async function sha256Base64(text: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return btoa(String.fromCharCode(...new Uint8Array(digest)));
}

export class ObsClient {
  private ws: WebSocket | null = null;
  private pending = new Map<string, { resolve: (value: Record<string, unknown>) => void; reject: (error: Error) => void }>();
  private nextId = 0;

  /** Opens and authenticates; rejects with a readable reason (OBS closed, wrong password…). */
  async connect(url: string, password: string, timeoutMs = 5000) {
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const fail = (message: string, code?: number) => {
        if (!settled) {
          settled = true;
          reject(new ObsError(message, code));
        }
      };
      const timer = setTimeout(() => fail("OBS didn't answer. Is OBS open with the WebSocket server turned on?"), timeoutMs);
      let ws: WebSocket;
      try {
        ws = new WebSocket(url, "obswebsocket.json");
      } catch {
        clearTimeout(timer);
        fail("That WebSocket address isn't valid.");
        return;
      }
      this.ws = ws;
      ws.onerror = () => fail("Couldn't reach OBS. Open OBS, then Tools → WebSocket Server Settings → Enable WebSocket server.");
      ws.onclose = (event) => {
        clearTimeout(timer);
        // 4009: authentication failed.
        fail(event.code === 4009 ? "OBS rejected the password. Copy it from Tools → WebSocket Server Settings → Show Connect Info." : "OBS closed the connection.", event.code);
        for (const { reject: rejectPending } of this.pending.values()) {
          rejectPending(new ObsError("OBS disconnected."));
        }
        this.pending.clear();
      };
      ws.onmessage = async (event) => {
        const message = JSON.parse(String(event.data)) as Message;
        if (message.op === 0) {
          // Hello: answer with Identify, authenticating if OBS asks for it.
          const auth = message.d.authentication as { challenge: string; salt: string } | undefined;
          if (auth && !password) {
            clearTimeout(timer);
            fail("OBS needs its WebSocket password.", 4009);
            ws.close();
            return;
          }
          const authentication = auth ? await sha256Base64((await sha256Base64(password + auth.salt)) + auth.challenge) : undefined;
          ws.send(JSON.stringify({ op: 1, d: { rpcVersion: 1, ...(authentication ? { authentication } : {}), eventSubscriptions: 0 } }));
        } else if (message.op === 2) {
          clearTimeout(timer);
          settled = true;
          resolve();
        } else if (message.op === 7) {
          const id = String(message.d.requestId);
          const handlers = this.pending.get(id);
          this.pending.delete(id);
          const status = message.d.requestStatus as { result: boolean; code: number; comment?: string };
          if (status.result) {
            handlers?.resolve((message.d.responseData as Record<string, unknown>) ?? {});
          } else {
            handlers?.reject(new ObsError(status.comment ?? `OBS request failed (${status.code}).`, status.code));
          }
        }
      };
    });
  }

  request<T = Record<string, unknown>>(requestType: string, requestData: Record<string, unknown> = {}): Promise<T> {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new ObsError("Not connected to OBS."));
    }
    const requestId = `sk-${(this.nextId += 1)}`;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(requestId, { resolve: resolve as (value: Record<string, unknown>) => void, reject });
      ws.send(JSON.stringify({ op: 6, d: { requestType, requestId, requestData } }));
    });
  }

  close() {
    this.ws?.close();
    this.ws = null;
  }

  async scenes() {
    const result = await this.request<{ currentProgramSceneName: string; scenes: { sceneName: string }[] }>("GetSceneList");
    return { current: result.currentProgramSceneName, names: result.scenes.map((scene) => scene.sceneName).reverse() };
  }

  async createScene(name: string) {
    await this.request("CreateScene", { sceneName: name }).catch((error: ObsError) => {
      // 601: a scene with that name already exists, which is fine.
      if (error.code !== 601) {
        throw error;
      }
    });
  }

  /**
   * Adds (or updates) a browser source in a scene, sized and placed for the canvas. Re-running
   * it updates the URL and size instead of creating duplicates.
   */
  async addBrowserSource(sceneName: string, source: ObsSource) {
    const video = await this.request<{ baseWidth: number; baseHeight: number }>("GetVideoSettings");
    const scale = video.baseWidth / 1920;
    const inputSettings = { url: source.url, width: source.width, height: source.height, reroute_audio: true, shutdown: false, restart_when_active: false };
    let sceneItemId: number;
    try {
      ({ sceneItemId } = await this.request<{ sceneItemId: number }>("CreateInput", { sceneName, inputName: source.name, inputKind: "browser_source", inputSettings, sceneItemEnabled: true }));
    } catch (error) {
      if ((error as ObsError).code !== 601) {
        throw error;
      }
      // Already exists: refresh its settings and make sure it's in this scene.
      await this.request("SetInputSettings", { inputName: source.name, inputSettings, overlay: true });
      try {
        ({ sceneItemId } = await this.request<{ sceneItemId: number }>("GetSceneItemId", { sceneName, sourceName: source.name }));
      } catch {
        ({ sceneItemId } = await this.request<{ sceneItemId: number }>("CreateSceneItem", { sceneName, sourceName: source.name, sceneItemEnabled: true }));
      }
    }
    await this.request("SetSceneItemTransform", {
      sceneName,
      sceneItemId,
      sceneItemTransform: { positionX: source.x * scale, positionY: source.y * scale, scaleX: scale, scaleY: scale },
    });
    // Keep overlays above the game/camera.
    const { sceneItems } = await this.request<{ sceneItems: unknown[] }>("GetSceneItemList", { sceneName });
    await this.request("SetSceneItemIndex", { sceneName, sceneItemId, sceneItemIndex: Math.max(0, sceneItems.length - 1) });
    return sceneItemId;
  }
}
