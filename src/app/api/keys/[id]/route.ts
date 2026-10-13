import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { requireUser } from "@/lib/session";
import { relayHub } from "@/lib/ws/relay";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(request);
  if (user instanceof NextResponse) {
    return user;
  }
  const { id } = await params;
  try {
    // Better Auth checks that the key belongs to the session user.
    await getAuth().api.deleteApiKey({ headers: await headers(), body: { keyId: id } });
  } catch {
    return NextResponse.json({ error: "API key not found." }, { status: 404 });
  }
  const disconnected = relayHub.disconnectKey(id, "API key revoked");
  return NextResponse.json({ ok: true, disconnected });
}
