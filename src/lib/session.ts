import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getAppUrl } from "@/lib/app-url";
import { getAuth } from "@/lib/auth";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  // Read the request first: it marks the page as per-request even when building without
  // secrets, where getAuth() throws before the headers would otherwise be read.
  const requestHeaders = await headers();
  const session = await getAuth().api.getSession({ headers: requestHeaders });
  if (!session) {
    return null;
  }
  const { id, name, email, image } = session.user;
  return { id, name, email, image: image ?? null };
}

/**
 * Auth guard for SignalKit's own route handlers (Better Auth guards its own routes).
 * Mutating requests must come from our origin: SameSite=Lax cookies still flow on
 * same-site requests from other subdomains, so the Origin header is checked too.
 */
export async function requireUser(request: Request): Promise<CurrentUser | NextResponse> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    const origin = request.headers.get("origin");
    if (origin !== getAppUrl()) {
      return NextResponse.json({ error: "Cross-origin request rejected." }, { status: 403 });
    }
  }
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return user;
}
