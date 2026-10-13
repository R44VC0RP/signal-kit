import { DEFAULT_API_KEY_PERMISSIONS, getAuth } from "@/lib/auth";

/** Verifies an API key for the relay socket. Disabled, expired, or rate-limited keys are rejected. */
export async function authenticateApiKey(rawKey: string) {
  const result = await getAuth().api.verifyApiKey({
    body: { key: rawKey, permissions: DEFAULT_API_KEY_PERMISSIONS },
  });
  if (!result.valid || !result.key) {
    return null;
  }
  return { userId: result.key.referenceId, keyId: result.key.id, label: result.key.name ?? "API key" };
}

/** Dashboard sockets authenticate with the Better Auth session cookie instead of an API key. */
export async function authenticateSession(cookie: string | undefined) {
  if (!cookie) {
    return null;
  }
  const session = await getAuth().api.getSession({ headers: new Headers({ cookie }) });
  if (!session) {
    return null;
  }
  return { userId: session.user.id, keyId: `session:${session.session.id}`, label: "Dashboard" };
}
