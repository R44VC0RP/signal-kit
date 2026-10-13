import { createHash, randomUUID } from "crypto";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { overlays } from "@/db/schema";
import { getAppUrl } from "@/lib/app-url";
import { randomToken } from "@/lib/crypto";
import { decryptToken, encryptToken } from "@/lib/connections/tokens";
import { defaultSettings, overlayTypeInfo, sanitizeSettings, type AnySettings, type GoalSettings, type OverlayType } from "./settings";
import { ensureGoal } from "./stats";

export type OverlayRow = typeof overlays.$inferSelect;

/** What the dashboard gets for an overlay: settings plus its browser-source URL. */
export type OverlayView = {
  id: string;
  type: OverlayType;
  name: string;
  settings: AnySettings;
  url: string;
  width: number;
  height: number;
  lastSeenAt: string | null;
  createdAt: string;
};

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

async function newToken() {
  // "sko_" makes leaked overlay URLs easy to recognise; the token only receives events.
  const token = `sko_${randomToken(24)}`;
  return { token, tokenHash: hashToken(token), tokenEncrypted: await encryptToken(token) };
}

export function overlayUrl(token: string) {
  return `${getAppUrl()}/overlay/${token}`;
}

export async function toView(row: OverlayRow): Promise<OverlayView> {
  const info = overlayTypeInfo(row.type);
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    settings: sanitizeSettings(row.type, row.settings),
    url: overlayUrl(await decryptToken(row.tokenEncrypted)),
    width: info.width,
    height: info.height,
    lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listOverlays(userId: string) {
  return getDb().select().from(overlays).where(eq(overlays.userId, userId)).orderBy(asc(overlays.createdAt), asc(overlays.type));
}

export async function getOverlay(userId: string, id: string) {
  const [row] = await getDb()
    .select()
    .from(overlays)
    .where(and(eq(overlays.userId, userId), eq(overlays.id, id)))
    .limit(1);
  return row ?? null;
}

/** The overlay a browser-source URL points at, or null if the URL was reset or never existed. */
export async function findOverlayByToken(token: string) {
  if (!token.startsWith("sko_") || token.length > 100) {
    return null;
  }
  const [row] = await getDb().select().from(overlays).where(eq(overlays.tokenHash, hashToken(token))).limit(1);
  return row ?? null;
}

export async function createOverlay(userId: string, type: OverlayType, name?: string) {
  const id = randomUUID();
  await getDb()
    .insert(overlays)
    .values({
      id,
      userId,
      type,
      name: (name?.trim() || overlayTypeInfo(type).name).slice(0, 80),
      settings: defaultSettings(type),
      ...(await newToken()),
    });
  const row = (await getOverlay(userId, id))!;
  await syncGoal(row);
  return row;
}

/** Goal overlays count from when they were created, or from when what they count changed. */
async function syncGoal(row: OverlayRow) {
  if (row.type === "goal") {
    const settings = sanitizeSettings("goal", row.settings) as GoalSettings;
    await ensureGoal(row.userId, row.id, settings.metric, settings.currency).catch((error) => console.error("[overlays] goal start failed", error));
  }
}

export async function updateOverlay(row: OverlayRow, input: { name?: unknown; settings?: unknown }) {
  const values: Partial<typeof overlays.$inferInsert> = {};
  if (typeof input.name === "string" && input.name.trim()) {
    values.name = input.name.trim().slice(0, 80);
  }
  if (input.settings !== undefined) {
    values.settings = sanitizeSettings(row.type, input.settings);
  }
  if (Object.keys(values).length > 0) {
    await getDb().update(overlays).set(values).where(eq(overlays.id, row.id));
  }
  const updated = (await getOverlay(row.userId, row.id))!;
  await syncGoal(updated);
  return updated;
}

/** Issues a new URL; the old one stops working immediately. */
export async function resetOverlayUrl(row: OverlayRow) {
  await getDb().update(overlays).set(await newToken()).where(eq(overlays.id, row.id));
  return (await getOverlay(row.userId, row.id))!;
}

export async function deleteOverlay(row: OverlayRow) {
  await getDb().delete(overlays).where(eq(overlays.id, row.id));
}

export async function markOverlaySeen(id: string) {
  await getDb().update(overlays).set({ lastSeenAt: new Date() }).where(eq(overlays.id, id));
}

export async function markOverlayTested(id: string) {
  await getDb().update(overlays).set({ lastTestAt: new Date() }).where(eq(overlays.id, id));
}
