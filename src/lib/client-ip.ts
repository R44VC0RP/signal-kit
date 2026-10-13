import type { IncomingMessage } from "http";

/** Set by server/index.ts on every request; Better Auth reads the client IP from it. */
export const CLIENT_IP_HEADER = "x-signalkit-client-ip";

/**
 * The visitor's IP. The app is only reachable through exe.dev's proxy, which appends the
 * address it saw to X-Forwarded-For (twice, e.g. "1.2.3.4, 1.2.3.4"). Anything to the left
 * came from the client and can be forged, so the rightmost entry is the trustworthy one.
 */
export function clientIpOf(req: IncomingMessage): string {
  const forwarded = req.headers["x-forwarded-for"];
  const value = Array.isArray(forwarded) ? forwarded.join(",") : forwarded;
  const last = value
    ?.split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .at(-1);
  return last || req.socket.remoteAddress || "unknown";
}
