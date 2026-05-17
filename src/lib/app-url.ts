export function getAppUrl(request?: Request) {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }

  if (request) {
    const url = new URL(request.url);
    return `${url.protocol}//${url.host}`;
  }

  return `http://localhost:${process.env.PORT ?? "3000"}`;
}

export function getWsUrl() {
  return getAppUrl().replace(/^http:/, "ws:").replace(/^https:/, "wss:") + "/ws";
}
