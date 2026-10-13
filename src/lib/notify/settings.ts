import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { userSettings } from "@/db/schema";
import { decryptToken, encryptToken } from "@/lib/connections/tokens";

/** Per-user preferences: Discord notifications and the public stats page. */

export type UserPreferences = {
  discordWebhookSet: boolean;
  discordLive: boolean;
  discordRecap: boolean;
  publicSlug: string | null;
};

const WEBHOOK = /^https:\/\/(?:(?:ptb|canary)\.)?discord(?:app)?\.com\/api\/webhooks\/\d{5,30}\/[\w-]{20,120}$/;
const SLUG = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/;

export function isDiscordWebhook(url: string) {
  return WEBHOOK.test(url);
}

export function isValidSlug(slug: string) {
  return SLUG.test(slug) && !["admin", "api", "app", "dashboard", "docs", "signal", "signalkit", "settings"].includes(slug);
}

async function row(userId: string) {
  const [found] = await getDb().select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1);
  return found ?? null;
}

export async function getPreferences(userId: string): Promise<UserPreferences> {
  const found = await row(userId);
  return {
    discordWebhookSet: Boolean(found?.discordWebhook),
    discordLive: found?.discordLive ?? true,
    discordRecap: found?.discordRecap ?? true,
    publicSlug: found?.publicSlug ?? null,
  };
}

/** The decrypted webhook, server-side only (never sent back to the browser). */
export async function discordWebhookFor(userId: string) {
  const found = await row(userId);
  return found?.discordWebhook ? { url: await decryptToken(found.discordWebhook), live: found.discordLive, recap: found.discordRecap } : null;
}

export async function userIdForSlug(slug: string) {
  const [found] = await getDb().select({ userId: userSettings.userId }).from(userSettings).where(eq(userSettings.publicSlug, slug)).limit(1);
  return found?.userId ?? null;
}

/** Applies validated changes; returns an error message for bad input or a taken slug. */
export async function updatePreferences(
  userId: string,
  input: { discordWebhook?: unknown; discordLive?: unknown; discordRecap?: unknown; publicSlug?: unknown },
): Promise<{ preferences: UserPreferences } | { error: string }> {
  const values: Partial<typeof userSettings.$inferInsert> = {};
  if (typeof input.discordWebhook === "string") {
    const url = input.discordWebhook.trim();
    if (url && !isDiscordWebhook(url)) {
      return { error: "That isn't a Discord webhook URL. In Discord: Server Settings → Integrations → Webhooks → Copy Webhook URL." };
    }
    values.discordWebhook = url ? await encryptToken(url) : null;
  }
  if (typeof input.discordLive === "boolean") {
    values.discordLive = input.discordLive;
  }
  if (typeof input.discordRecap === "boolean") {
    values.discordRecap = input.discordRecap;
  }
  if (input.publicSlug === null || typeof input.publicSlug === "string") {
    const slug = typeof input.publicSlug === "string" ? input.publicSlug.trim().toLowerCase() : "";
    if (slug && !isValidSlug(slug)) {
      return { error: "Use 3–40 lowercase letters, numbers or dashes." };
    }
    if (slug) {
      const owner = await userIdForSlug(slug);
      if (owner && owner !== userId) {
        return { error: "That address is taken. Try another." };
      }
    }
    values.publicSlug = slug || null;
  }
  await getDb()
    .insert(userSettings)
    .values({ userId, ...values })
    .onDuplicateKeyUpdate({ set: Object.keys(values).length ? values : { userId } });
  return { preferences: await getPreferences(userId) };
}
