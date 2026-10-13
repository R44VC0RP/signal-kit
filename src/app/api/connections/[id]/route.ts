import { NextResponse } from "next/server";
import { z } from "zod";
import { ConnectionActionError, disconnectConnection, setConnectionRole } from "@/lib/connections/manage";
import { requireUser } from "@/lib/session";

const patchSchema = z.object({ role: z.enum(["broadcaster", "bot"]) });

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const user = await requireUser(request);
  if (user instanceof NextResponse) {
    return user;
  }
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Expected { role: \"broadcaster\" | \"bot\" }." }, { status: 400 });
  }
  const { id } = await params;
  return handle(() => setConnectionRole(user.id, id, parsed.data.role));
}

export async function DELETE(request: Request, { params }: Params) {
  const user = await requireUser(request);
  if (user instanceof NextResponse) {
    return user;
  }
  const { id } = await params;
  return handle(() => disconnectConnection(user.id, id));
}

async function handle(action: () => Promise<unknown>) {
  try {
    await action();
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ConnectionActionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
