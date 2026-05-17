import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { destroyCurrentSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";

export async function POST(request: Request) {
  await destroyCurrentSession();
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", { ...sessionCookieOptions(new Date(0)), maxAge: 0 });
  return NextResponse.redirect(new URL("/", request.url), 303);
}
