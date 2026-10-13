import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth";

// Resolved per request so importing this module never needs a database connection.
export function GET(request: Request) {
  return toNextJsHandler(getAuth()).GET(request);
}

export function POST(request: Request) {
  return toNextJsHandler(getAuth()).POST(request);
}
