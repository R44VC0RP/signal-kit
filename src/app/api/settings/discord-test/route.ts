import { NextResponse } from "next/server";
import { sendDiscordTest } from "@/lib/notify/discord";
import { discordWebhookFor } from "@/lib/notify/settings";
import { requireUser } from "@/lib/session";

/** Posts a test message to the saved Discord webhook. */
export async function POST(request: Request) {
  const user = await requireUser(request);
  if (user instanceof NextResponse) {
    return user;
  }
  const webhook = await discordWebhookFor(user.id);
  if (!webhook) {
    return NextResponse.json({ error: "Save a Discord webhook first." }, { status: 400 });
  }
  try {
    await sendDiscordTest(webhook.url);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: `Discord didn't accept it (${(error as Error).message}). Check the webhook still exists.` }, { status: 502 });
  }
}
