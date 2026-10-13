/**
 * The public origin of this deployment. OAuth redirects and cookies depend on it,
 * so it always comes from configuration, never from the request's Host header.
 */
export function getAppUrl() {
  const configured = process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (configured) {
    return configured.replace(/\/$/, "");
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_APP_URL (or BETTER_AUTH_URL) must be set in production.");
  }
  return `http://localhost:${process.env.PORT ?? "3000"}`;
}

export function getWsUrl() {
  return getAppUrl().replace(/^http:/, "ws:").replace(/^https:/, "wss:") + "/ws";
}
