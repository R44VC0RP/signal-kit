import type { connections } from "@/db/schema";

/** The connection fields safe to send to the browser. */
export function toPublicConnection(row: typeof connections.$inferSelect) {
  return {
    id: row.id,
    platform: row.platform,
    platformUserId: row.platformUserId,
    username: row.username,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
    role: row.role,
    status: row.status,
    statusReason: row.statusReason,
    scopes: row.scopes,
    lastEventAt: row.lastEventAt?.toISOString() ?? null,
    lastValidatedAt: row.lastValidatedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export type PublicConnection = ReturnType<typeof toPublicConnection>;
