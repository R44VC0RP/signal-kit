import {
  boolean,
  index,
  int,
  json,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

// Better Auth core tables (generated with `auth generate`, then adjusted):
// - no foreign keys, because PlanetScale rejects them; ownership is enforced in code
// - provider/account ids are varchar so a platform account can be unique across users

export const users = mysqlTable("users", {
  id: varchar("id", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { fsp: 3 })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const sessions = mysqlTable(
  "sessions",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    expiresAt: timestamp("expires_at", { fsp: 3 }).notNull(),
    token: varchar("token", { length: 255 }).notNull().unique(),
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 })
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: varchar("user_id", { length: 36 }).notNull(),
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)],
);

/** OAuth credentials per platform login. Tokens are encrypted by Better Auth (encryptOAuthTokens). */
export const accounts = mysqlTable(
  "accounts",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    accountId: varchar("account_id", { length: 255 }).notNull(),
    providerId: varchar("provider_id", { length: 64 }).notNull(),
    userId: varchar("user_id", { length: 36 }).notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { fsp: 3 }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { fsp: 3 }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 })
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("accounts_user_id_idx").on(table.userId),
    uniqueIndex("accounts_provider_account_idx").on(table.providerId, table.accountId),
  ],
);

export const verifications = mysqlTable(
  "verifications",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    identifier: varchar("identifier", { length: 255 }).notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { fsp: 3 }).notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("verifications_identifier_idx").on(table.identifier)],
);

/** Better Auth api-key plugin table. `key` holds a hash, never the raw key. */
export const apiKeys = mysqlTable(
  "api_keys",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    configId: varchar("config_id", { length: 255 }).default("default").notNull(),
    name: text("name"),
    start: text("start"),
    referenceId: varchar("reference_id", { length: 255 }).notNull(),
    prefix: text("prefix"),
    key: varchar("key", { length: 255 }).notNull(),
    refillInterval: int("refill_interval"),
    refillAmount: int("refill_amount"),
    lastRefillAt: timestamp("last_refill_at", { fsp: 3 }),
    enabled: boolean("enabled").default(true),
    rateLimitEnabled: boolean("rate_limit_enabled").default(true),
    rateLimitTimeWindow: int("rate_limit_time_window").default(60000),
    rateLimitMax: int("rate_limit_max").default(120),
    requestCount: int("request_count").default(0),
    remaining: int("remaining"),
    lastRequest: timestamp("last_request", { fsp: 3 }),
    expiresAt: timestamp("expires_at", { fsp: 3 }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull(),
    permissions: text("permissions"),
    metadata: text("metadata"),
  },
  (table) => [
    index("api_keys_config_id_idx").on(table.configId),
    index("api_keys_reference_id_idx").on(table.referenceId),
    uniqueIndex("api_keys_key_idx").on(table.key),
  ],
);

// SignalKit tables.

export type Platform = "twitch" | "youtube" | "x";
export type ConnectionRole = "broadcaster" | "bot";
export type ConnectionStatus = "active" | "needs_reauth" | "error";

/**
 * A platform channel/account a user has connected. One row per Better Auth account,
 * so a user can connect several accounts on the same platform (e.g. a channel and a bot).
 * A platform account can belong to only one SignalKit user.
 */
export const connections = mysqlTable(
  "connections",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 }).notNull(),
    accountId: varchar("account_id", { length: 36 }).notNull(),
    platform: varchar("platform", { length: 16 }).$type<Platform>().notNull(),
    platformUserId: varchar("platform_user_id", { length: 128 }).notNull(),
    username: varchar("username", { length: 255 }).notNull(),
    displayName: varchar("display_name", { length: 255 }).notNull(),
    avatarUrl: text("avatar_url"),
    role: varchar("role", { length: 16 }).$type<ConnectionRole>().notNull().default("broadcaster"),
    status: varchar("status", { length: 24 }).$type<ConnectionStatus>().notNull().default("active"),
    statusReason: text("status_reason"),
    scopes: json("scopes").$type<string[]>().notNull(),
    profileSyncedAt: timestamp("profile_synced_at", { fsp: 3 }),
    lastValidatedAt: timestamp("last_validated_at", { fsp: 3 }),
    lastEventAt: timestamp("last_event_at", { fsp: 3 }),
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("connections_user_id_idx").on(table.userId),
    uniqueIndex("connections_account_id_idx").on(table.accountId),
    uniqueIndex("connections_platform_user_idx").on(table.platform, table.platformUserId),
  ],
);

/** Desired and actual server-side event subscriptions per connection (Twitch EventSub today, X Activity API next). */
export const platformSubscriptions = mysqlTable(
  "platform_subscriptions",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    connectionId: varchar("connection_id", { length: 36 }).notNull(),
    platform: varchar("platform", { length: 16 }).$type<Platform>().notNull(),
    type: varchar("type", { length: 128 }).notNull(),
    version: varchar("version", { length: 16 }).notNull(),
    conditionHash: varchar("condition_hash", { length: 64 }).notNull(),
    conditionJson: json("condition_json").$type<Record<string, string>>().notNull(),
    requiredScopes: json("required_scopes").$type<string[]>().notNull(),
    status: varchar("status", { length: 32 }).notNull().default("desired"),
    remoteId: varchar("remote_id", { length: 128 }),
    transportSessionId: varchar("transport_session_id", { length: 128 }),
    error: text("error"),
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("platform_subscriptions_connection_idx").on(table.connectionId),
    index("platform_subscriptions_remote_idx").on(table.remoteId),
    uniqueIndex("platform_subscriptions_unique_idx").on(
      table.connectionId,
      table.type,
      table.version,
      table.conditionHash,
    ),
  ],
);

/**
 * Recent normalized events, kept briefly so a client that reconnects can catch up (`since`).
 * `sourceId` is the platform's own message id and makes ingestion idempotent across retries.
 */
export const events = mysqlTable(
  "events",
  {
    id: varchar("id", { length: 26 }).primaryKey(),
    userId: varchar("user_id", { length: 36 }).notNull(),
    connectionId: varchar("connection_id", { length: 36 }).notNull(),
    platform: varchar("platform", { length: 16 }).$type<Platform>().notNull(),
    kind: varchar("kind", { length: 48 }).notNull(),
    sourceId: varchar("source_id", { length: 191 }).notNull(),
    envelope: json("envelope").notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
  },
  (table) => [
    index("events_user_id_idx").on(table.userId, table.id),
    index("events_created_at_idx").on(table.createdAt),
    uniqueIndex("events_source_idx").on(table.platform, table.sourceId),
  ],
);

/** Per-environment key/value state (e.g. this deployment's Twitch conduit id). */
export const appSettings = mysqlTable("app_settings", {
  key: varchar("key", { length: 64 }).primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { fsp: 3 })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});
