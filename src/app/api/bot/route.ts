import { NextResponse } from "next/server";
import { botContext as context } from "@/lib/bot/context";
import { chatBot } from "@/lib/bot/engine";
import { requireUser } from "@/lib/session";

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (user instanceof NextResponse) {
    return user;
  }
  return NextResponse.json({ config: await chatBot.config(user.id), ...(await context(user.id)) });
}

export async function PUT(request: Request) {
  const user = await requireUser(request);
  if (user instanceof NextResponse) {
    return user;
  }
  const body = (await request.json().catch(() => ({}))) as { config?: unknown };
  return NextResponse.json({ config: await chatBot.save(user.id, body.config), ...(await context(user.id)) });
}
