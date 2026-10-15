import { and, desc, eq, gte, ne, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { loyalty, type Platform } from "@/db/schema";
import { youtubeCutoff } from "@/lib/retention/youtube-core";

/**
 * Loyalty points: earned by chatting (all platforms), watching (Twitch) and supporting.
 * YouTube viewers' rows are deleted after 30 days without activity (lib/retention/youtube.ts)
 * and hidden from reads once they are that old.
 */

/** Rows that may still be shown: any non-YouTube row, YouTube rows active in the last 30 days. */
const current = () => or(ne(loyalty.platform, "youtube"), gte(loyalty.updatedAt, new Date(youtubeCutoff())));

export type PointsGrant = { platform: Platform; chatterId: string; name: string; points: number; minutes?: number };

export async function addPoints(userId: string, grants: PointsGrant[]) {
  const rows = grants.filter((grant) => grant.chatterId && (grant.points > 0 || (grant.minutes ?? 0) > 0));
  for (let i = 0; i < rows.length; i += 500) {
    await getDb()
      .insert(loyalty)
      .values(rows.slice(i, i + 500).map((grant) => ({ userId, platform: grant.platform, chatterId: grant.chatterId.slice(0, 128), name: grant.name.slice(0, 128), points: grant.points, watchMinutes: grant.minutes ?? 0 })))
      .onDuplicateKeyUpdate({
        set: {
          points: sql`${loyalty.points} + values(${loyalty.points})`,
          watchMinutes: sql`${loyalty.watchMinutes} + values(${loyalty.watchMinutes})`,
          name: sql`values(${loyalty.name})`,
        },
      });
  }
}

export async function pointsOf(userId: string, platform: Platform, chatterId: string) {
  const [row] = await getDb()
    .select({ points: loyalty.points })
    .from(loyalty)
    .where(and(eq(loyalty.userId, userId), eq(loyalty.platform, platform), eq(loyalty.chatterId, chatterId)))
    .limit(1);
  const points = row?.points ?? 0;
  const [rank] = await getDb()
    .select({ ahead: sql<number>`count(*)` })
    .from(loyalty)
    .where(and(eq(loyalty.userId, userId), current(), sql`${loyalty.points} > ${points}`));
  return { points, rank: Number(rank?.ahead ?? 0) + 1 };
}

export function topPoints(userId: string, limit = 5) {
  return getDb()
    .select({ platform: loyalty.platform, name: loyalty.name, points: loyalty.points, watchMinutes: loyalty.watchMinutes })
    .from(loyalty)
    .where(and(eq(loyalty.userId, userId), current()))
    .orderBy(desc(loyalty.points))
    .limit(limit);
}

/** Spends points if the viewer has enough; one UPDATE so two redeems can't both pass. */
export async function spendPoints(userId: string, platform: Platform, chatterId: string, cost: number) {
  const [result] = await getDb()
    .update(loyalty)
    .set({ points: sql`${loyalty.points} - ${cost}` })
    .where(and(eq(loyalty.userId, userId), eq(loyalty.platform, platform), eq(loyalty.chatterId, chatterId), gte(loyalty.points, cost)));
  return (result as unknown as { affectedRows: number }).affectedRows > 0;
}

/** Sets or adjusts a viewer's points by name (dashboard edits). */
export async function adjustPoints(userId: string, platform: Platform, chatterId: string, delta: number) {
  await getDb()
    .update(loyalty)
    // A streamer's edit isn't viewer activity: keep updatedAt, which YouTube retention reads (30 days without activity).
    .set({ points: sql`greatest(0, ${loyalty.points} + ${delta})`, updatedAt: sql`${loyalty.updatedAt}` })
    .where(and(eq(loyalty.userId, userId), eq(loyalty.platform, platform), eq(loyalty.chatterId, chatterId)));
}
