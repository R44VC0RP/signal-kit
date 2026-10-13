import { NextResponse } from "next/server";
import { getPreferences, updatePreferences } from "@/lib/notify/settings";
import { requireUser } from "@/lib/session";

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (user instanceof NextResponse) {
    return user;
  }
  return NextResponse.json({ preferences: await getPreferences(user.id) });
}

export async function PATCH(request: Request) {
  const user = await requireUser(request);
  if (user instanceof NextResponse) {
    return user;
  }
  const result = await updatePreferences(user.id, (await request.json().catch(() => ({}))) as Record<string, unknown>);
  return NextResponse.json(result, { status: "error" in result ? 400 : 200 });
}
