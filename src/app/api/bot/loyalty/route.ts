import { NextResponse } from "next/server";
import { topPoints } from "@/lib/bot/loyalty";
import { requireUser } from "@/lib/session";

/** The points leaderboard for the dashboard. */
export async function GET(request: Request) {
  const user = await requireUser(request);
  if (user instanceof NextResponse) {
    return user;
  }
  return NextResponse.json({ leaderboard: await topPoints(user.id, 50) });
}
