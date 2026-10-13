import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { connections } from "@/db/schema";
import { ConnectionUnavailableError, forceRefresh, getConnectionAccessToken, markNeedsReauth } from "./tokens";

const VALIDATE_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Twitch requires apps to validate user tokens hourly and to stop using tokens that fail.
 * A 401 gets one forced refresh; if the refresh is rejected the connection moves to needs_reauth.
 */
export async function validateTwitchConnections() {
  const rows = await getDb()
    .select()
    .from(connections)
    .where(and(eq(connections.platform, "twitch"), eq(connections.status, "active")));

  for (const connection of rows) {
    try {
      const { accessToken } = await getConnectionAccessToken(connection.id);
      if ((await validate(accessToken)) === 401) {
        const refreshed = await forceRefresh(connection);
        if ((await validate(refreshed)) === 401) {
          await markNeedsReauth(connection.accountId, "Twitch rejected the token after a refresh. Reconnect Twitch.");
          continue;
        }
      }
      await getDb().update(connections).set({ lastValidatedAt: new Date() }).where(eq(connections.id, connection.id));
    } catch (error) {
      if (!(error instanceof ConnectionUnavailableError)) {
        console.error(`[health] twitch validation failed for ${connection.id}`, error);
      }
    }
  }
}

async function validate(accessToken: string) {
  const response = await fetch("https://id.twitch.tv/oauth2/validate", {
    headers: { Authorization: `OAuth ${accessToken}` },
  });
  if (response.status !== 401 && !response.ok) {
    throw new Error(`Twitch validate failed (${response.status}).`);
  }
  return response.status;
}

let timer: NodeJS.Timeout | undefined;

export function startConnectionHealthChecks() {
  if (timer) {
    return;
  }
  const run = () =>
    void validateTwitchConnections().catch((error) => console.error("[health] validation pass failed", error));
  run();
  timer = setInterval(run, VALIDATE_INTERVAL_MS);
}
