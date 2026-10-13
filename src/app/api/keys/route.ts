import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuth } from "@/lib/auth";
import { requireUser } from "@/lib/session";

const createSchema = z.object({ name: z.string().trim().min(1).max(120).default("API key") });

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (user instanceof NextResponse) {
    return user;
  }
  const result = await getAuth().api.listApiKeys({ headers: await headers() });
  return NextResponse.json({ keys: result.apiKeys.map(toPublicKey) });
}

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (user instanceof NextResponse) {
    return user;
  }
  const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Name must be 1-120 characters." }, { status: 400 });
  }
  const created = await getAuth().api.createApiKey({ body: { name: parsed.data.name, userId: user.id } });
  // The raw key is returned exactly once; only its hash is stored.
  return NextResponse.json({ key: created.key, record: toPublicKey(created) });
}

type ApiKeyRecord = {
  id: string;
  name: string | null;
  start: string | null;
  enabled: boolean;
  createdAt: Date;
  lastRequest: Date | null;
  expiresAt: Date | null;
};

function toPublicKey(key: ApiKeyRecord) {
  return {
    id: key.id,
    name: key.name,
    start: key.start,
    enabled: key.enabled,
    createdAt: new Date(key.createdAt).toISOString(),
    lastUsedAt: key.lastRequest ? new Date(key.lastRequest).toISOString() : null,
    expiresAt: key.expiresAt ? new Date(key.expiresAt).toISOString() : null,
  };
}
