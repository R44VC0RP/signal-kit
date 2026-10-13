import { NextResponse } from "next/server";
import { listConnections } from "@/lib/connections/manage";
import { toPublicConnection } from "@/lib/connections/public";
import { syncConnectionsForUser } from "@/lib/connections/sync";
import { requireUser } from "@/lib/session";

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (user instanceof NextResponse) {
    return user;
  }
  await syncConnectionsForUser(user.id);
  const rows = await listConnections(user.id);
  return NextResponse.json({ connections: rows.map(toPublicConnection) });
}
