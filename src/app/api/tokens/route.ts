import { eq, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { overlayTokens } from "@/db/schema";
import { randomToken, tokenHash } from "@/lib/crypto";
import { getCurrentUser } from "@/lib/session";

const createTokenSchema = z.object({ label: z.string().min(1).max(120).default("Overlay token") });

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tokens = await getDb()
    .select({
      id: overlayTokens.id,
      label: overlayTokens.label,
      createdAt: overlayTokens.createdAt,
      lastUsedAt: overlayTokens.lastUsedAt,
      revokedAt: overlayTokens.revokedAt,
    })
    .from(overlayTokens)
    .where(or(eq(overlayTokens.appUserId, user.id), eq(overlayTokens.twitchUserId, user.id)));

  return NextResponse.json({ tokens });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = createTokenSchema.parse(await request.json().catch(() => ({})));
  const rawToken = `sk_live_${randomToken(32)}`;
  const row = {
    id: randomToken(24),
    appUserId: user.id,
    twitchUserId: user.twitchUserId,
    tokenHash: tokenHash(rawToken),
    label: body.label,
  };
  await getDb().insert(overlayTokens).values(row);
  return NextResponse.json({ token: rawToken, tokenRecord: { id: row.id, label: row.label } });
}
