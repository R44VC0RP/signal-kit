import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { appSettings } from "@/db/schema";

/**
 * Helix calls made as the Signal Kit app itself (client-credentials token).
 * Conduits and conduit subscriptions require an app token; per-user authorization
 * comes from the scopes each streamer granted when connecting.
 */

const HELIX = "https://api.twitch.tv/helix";

let appToken: { value: string; expiresAt: number } | null = null;
let inflightToken: Promise<string> | null = null;

function credentials() {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET are required.");
  }
  return { clientId, clientSecret };
}

async function getAppToken(force = false): Promise<string> {
  if (!force && appToken && appToken.expiresAt > Date.now() + 60 * 60 * 1000) {
    return appToken.value;
  }
  inflightToken ??= (async () => {
    const { clientId, clientSecret } = credentials();
    const response = await fetch("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: "client_credentials" }),
    });
    if (!response.ok) {
      throw new Error(`Twitch app token request failed (${response.status}).`);
    }
    const json = (await response.json()) as { access_token: string; expires_in: number };
    appToken = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
    return appToken.value;
  })().finally(() => {
    inflightToken = null;
  });
  return inflightToken;
}

export class HelixError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
  ) {
    super(`Twitch ${status}: ${summarize(body)}`);
  }
}

export async function helixApp<T>(method: string, path: string, body?: unknown, retried = false): Promise<T> {
  const token = await getAppToken();
  const response = await fetch(`${HELIX}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Client-Id": credentials().clientId,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (response.status === 401 && !retried) {
    await getAppToken(true);
    return helixApp<T>(method, path, body, true);
  }
  const text = await response.text();
  if (!response.ok) {
    throw new HelixError(response.status, text);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

type Conduit = { id: string; shard_count: number };

const CONDUIT_SETTING = "twitch_conduit_id";

/**
 * This deployment's conduit. The id is stored in this environment's own database so a
 * dev machine and production (same Twitch app) never share, or clean up, each other's conduit.
 */
export async function ensureConduit(): Promise<string> {
  const [stored] = await getDb().select().from(appSettings).where(eq(appSettings.key, CONDUIT_SETTING)).limit(1);
  if (stored) {
    const existing = await helixApp<{ data: Conduit[] }>("GET", "/eventsub/conduits");
    if (existing.data.some((conduit) => conduit.id === stored.value)) {
      return stored.value;
    }
    // Twitch deletes conduits whose shards stay disabled for 72 hours; create a fresh one.
    console.warn("[conduit] stored conduit no longer exists; creating a new one");
  }
  const created = await helixApp<{ data: Conduit[] }>("POST", "/eventsub/conduits", { shard_count: 1 });
  const id = created.data[0].id;
  await getDb()
    .insert(appSettings)
    .values({ key: CONDUIT_SETTING, value: id })
    .onDuplicateKeyUpdate({ set: { value: id } });
  return id;
}

export async function assignShard(conduitId: string, shardId: string, sessionId: string) {
  const result = await helixApp<{ data: { id: string; status: string }[]; errors?: { id: string; message: string; code: string }[] }>(
    "PATCH",
    "/eventsub/conduits/shards",
    { conduit_id: conduitId, shards: [{ id: shardId, transport: { method: "websocket", session_id: sessionId } }] },
  );
  if (result.errors?.length) {
    throw new Error(`Shard assignment failed: ${result.errors.map((error) => error.message).join("; ")}`);
  }
  return result.data[0]?.status;
}

export type RemoteSubscription = {
  id: string;
  status: string;
  type: string;
  version: string;
  condition: Record<string, string>;
  transport: { method: string; conduit_id?: string };
};

/** Every subscription on this conduit (Helix lists all of the app's subscriptions; filter by conduit). */
export async function listConduitSubscriptions(conduitId: string) {
  const all: RemoteSubscription[] = [];
  let after: string | undefined;
  do {
    const page = await helixApp<{ data: RemoteSubscription[]; pagination?: { cursor?: string } }>(
      "GET",
      `/eventsub/subscriptions${after ? `?after=${encodeURIComponent(after)}` : ""}`,
    );
    all.push(...page.data.filter((sub) => sub.transport.method === "conduit" && sub.transport.conduit_id === conduitId));
    after = page.pagination?.cursor;
  } while (after);
  return all;
}

export async function createConduitSubscription(
  conduitId: string,
  input: { type: string; version: string; condition: Record<string, string> },
): Promise<{ id: string; status: string }> {
  try {
    const result = await helixApp<{ data: { id: string; status: string }[] }>("POST", "/eventsub/subscriptions", {
      ...input,
      transport: { method: "conduit", conduit_id: conduitId },
    });
    return result.data[0];
  } catch (error) {
    // Since 2026-04 a duplicate returns 409 with the existing subscription's id.
    if (error instanceof HelixError && error.status === 409) {
      const existing = safeJson(error.body) as { data?: { id: string; status: string }[]; id?: string; message?: string } | null;
      // The id comes back in `data`, or only inside the message: "subscription already exists; id=…".
      const id = existing?.data?.[0]?.id ?? existing?.id ?? existing?.message?.match(/id=([0-9a-f-]{36})/i)?.[1];
      if (id) {
        return { id, status: existing?.data?.[0]?.status ?? "enabled" };
      }
    }
    throw error;
  }
}

export async function deleteSubscription(id: string) {
  await helixApp("DELETE", `/eventsub/subscriptions?id=${encodeURIComponent(id)}`);
}

function safeJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function summarize(text: string) {
  const json = safeJson(text) as { message?: string; error?: string } | null;
  return json?.message ?? json?.error ?? text.slice(0, 200);
}
