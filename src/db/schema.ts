import {
  index,
  json,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const twitchUsers = mysqlTable("twitch_users", {
  id: varchar("id", { length: 64 }).primaryKey(),
  login: varchar("login", { length: 128 }).notNull(),
  displayName: varchar("display_name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  profileImageUrl: text("profile_image_url"),
  accessTokenEncrypted: text("access_token_encrypted").notNull(),
  refreshTokenEncrypted: text("refresh_token_encrypted").notNull(),
  tokenExpiresAt: timestamp("token_expires_at"),
  scopes: json("scopes").$type<string[]>().notNull(),
  connectedAt: timestamp("connected_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const appSessions = mysqlTable(
  "app_sessions",
  {
    id: varchar("id", { length: 128 }).primaryKey(),
    twitchUserId: varchar("twitch_user_id", { length: 64 })
      .notNull()
      .references(() => twitchUsers.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("app_sessions_user_idx").on(table.twitchUserId),
  }),
);

export const connectedAccounts = mysqlTable(
  "connected_accounts",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    ownerTwitchUserId: varchar("owner_twitch_user_id", { length: 64 })
      .notNull()
      .references(() => twitchUsers.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 32 }).notNull(),
    providerAccountId: varchar("provider_account_id", { length: 128 }).notNull(),
    login: varchar("login", { length: 128 }).notNull(),
    displayName: varchar("display_name", { length: 255 }).notNull(),
    profileImageUrl: text("profile_image_url"),
    accessTokenEncrypted: text("access_token_encrypted").notNull(),
    refreshTokenEncrypted: text("refresh_token_encrypted").notNull(),
    tokenExpiresAt: timestamp("token_expires_at"),
    scopes: json("scopes").$type<string[]>().notNull(),
    lastSyncAt: timestamp("last_sync_at"),
    lastEventAt: timestamp("last_event_at"),
    lastError: text("last_error"),
    connectedAt: timestamp("connected_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    ownerIdx: index("connected_accounts_owner_idx").on(table.ownerTwitchUserId),
    providerIdx: index("connected_accounts_provider_idx").on(table.provider),
    uniqueProviderAccount: uniqueIndex("connected_accounts_unique_provider_account_idx").on(
      table.ownerTwitchUserId,
      table.provider,
      table.providerAccountId,
    ),
  }),
);

export const overlayTokens = mysqlTable(
  "overlay_tokens",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    twitchUserId: varchar("twitch_user_id", { length: 64 })
      .notNull()
      .references(() => twitchUsers.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    label: varchar("label", { length: 120 }).notNull(),
    lastUsedAt: timestamp("last_used_at"),
    revokedAt: timestamp("revoked_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("overlay_tokens_user_idx").on(table.twitchUserId),
    tokenHashIdx: uniqueIndex("overlay_tokens_token_hash_idx").on(table.tokenHash),
  }),
);

export const eventSubscriptions = mysqlTable(
  "event_subscriptions",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    twitchUserId: varchar("twitch_user_id", { length: 64 })
      .notNull()
      .references(() => twitchUsers.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 128 }).notNull(),
    version: varchar("version", { length: 16 }).notNull(),
    conditionHash: varchar("condition_hash", { length: 64 }).notNull(),
    conditionJson: json("condition_json").$type<Record<string, string>>().notNull(),
    requiredScopes: json("required_scopes").$type<string[]>().notNull(),
    status: varchar("status", { length: 64 }).notNull().default("desired"),
    twitchSubscriptionId: varchar("twitch_subscription_id", { length: 128 }),
    twitchSessionId: varchar("twitch_session_id", { length: 128 }),
    error: text("error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    userIdx: index("event_subscriptions_user_idx").on(table.twitchUserId),
    uniqueDesired: uniqueIndex("event_subscriptions_unique_desired_idx").on(
      table.twitchUserId,
      table.type,
      table.version,
      table.conditionHash,
    ),
  }),
);
