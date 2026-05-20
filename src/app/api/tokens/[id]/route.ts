import { and, eq, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { overlayTokens } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await getDb()
    .update(overlayTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(overlayTokens.id, id),
        or(eq(overlayTokens.appUserId, user.id), eq(overlayTokens.twitchUserId, user.id)),
      ),
    );

  return NextResponse.json({ ok: true });
}
