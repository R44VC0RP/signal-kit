import { apiKey } from "@better-auth/api-key";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { addOAuthServerContext, APIError, createAuthMiddleware, getOAuthState } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { getDb } from "@/db";
import * as schema from "@/db/schema";
import type { ConnectionRole } from "@/db/schema";
import { getAppUrl } from "@/lib/app-url";
import { CLIENT_IP_HEADER } from "@/lib/client-ip";
import { syncConnectionsForUser } from "@/lib/connections/sync";
import { BOT_CAPABLE_PROVIDERS, isAuthProviderId, scopesFor } from "./scopes";

export const API_KEY_PREFIX = "sk_live_";

/** Permissions granted to every new API key. Checked by the relay on connect. */
export const DEFAULT_API_KEY_PERMISSIONS = { relay: ["read"] };

function createAuth() {
  const appUrl = getAppUrl();
  const socialProviders: Parameters<typeof betterAuth>[0]["socialProviders"] = {};

  if (process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET) {
    socialProviders.twitch = {
      clientId: process.env.TWITCH_CLIENT_ID,
      clientSecret: process.env.TWITCH_CLIENT_SECRET,
    };
  }
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    socialProviders.google = {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // Offline access + consent guarantees a refresh token on every (re)connect.
      accessType: "offline",
      prompt: "select_account consent",
    };
  }
  if (process.env.X_CLIENT_ID && process.env.X_CLIENT_SECRET) {
    socialProviders.twitter = {
      clientId: process.env.X_CLIENT_ID,
      clientSecret: process.env.X_CLIENT_SECRET,
    };
  }

  return betterAuth({
    appName: "Signal Kit",
    baseURL: appUrl,
    basePath: "/api/auth",
    secret: process.env.BETTER_AUTH_SECRET,
    trustedOrigins: [appUrl],
    database: drizzleAdapter(getDb(), {
      provider: "mysql",
      // Keyed by the modelName of each table below.
      schema: {
        users: schema.users,
        sessions: schema.sessions,
        accounts: schema.accounts,
        verifications: schema.verifications,
        api_keys: schema.apiKeys,
      },
    }),
    user: { modelName: "users" },
    session: {
      modelName: "sessions",
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
    },
    verification: { modelName: "verifications" },
    account: {
      modelName: "accounts",
      encryptOAuthTokens: true,
      accountLinking: {
        enabled: true,
        // Linking only happens when a signed-in user explicitly connects another account.
        // Prevents takeover through a platform that reports an unverified, matching email.
        disableImplicitLinking: true,
        allowDifferentEmails: true,
        updateUserInfoOnLink: false,
      },
    },
    socialProviders,
    disabledPaths: [
      // Platform tokens must never leave the server. These endpoints would return them to the browser.
      "/get-access-token",
      "/refresh-token",
      "/account-info",
      // Accounts are unlinked through /api/connections so platform grants are revoked too.
      "/unlink-account",
      // API keys are managed through /api/keys so revoking a key also closes its live sockets.
      "/api-key/create",
      "/api-key/update",
      "/api-key/delete",
      "/api-key/list",
      "/api-key/get",
    ],
    rateLimit: {
      enabled: true,
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/social": { window: 60, max: 10 },
        "/link-social": { window: 60, max: 10 },
      },
    },
    advanced: {
      cookiePrefix: "signalkit",
      useSecureCookies: appUrl.startsWith("https://"),
      ipAddress: { ipAddressHeaders: [CLIENT_IP_HEADER] },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/sign-in/social" && ctx.path !== "/link-social") {
          return;
        }
        const provider = ctx.body?.provider;
        if (!isAuthProviderId(provider)) {
          throw new APIError("BAD_REQUEST", { message: "Unsupported provider." });
        }
        const role: ConnectionRole = ctx.body?.additionalData?.role === "bot" ? "bot" : "broadcaster";
        if (role === "bot" && (ctx.path !== "/link-social" || !BOT_CAPABLE_PROVIDERS.includes(provider))) {
          throw new APIError("BAD_REQUEST", { message: "Bot accounts can only be linked for Twitch." });
        }
        // The server decides scopes and carries the role through the OAuth state, where the client can't change it.
        await addOAuthServerContext({ connectionRole: role });
        return { context: { body: { ...ctx.body, scopes: scopesFor(provider, role) } } };
      }),
      after: createAuthMiddleware(async (ctx) => {
        if (!ctx.path.startsWith("/callback/")) {
          return;
        }
        try {
          const state = await getOAuthState();
          const userId = ctx.context.newSession?.user.id ?? state?.link?.userId;
          const providerId = ctx.params?.id;
          if (!userId || !isAuthProviderId(providerId)) {
            return;
          }
          const role = state?.serverContext?.connectionRole === "bot" ? "bot" : "broadcaster";
          await syncConnectionsForUser(userId, { justLinked: { providerId, role } });
        } catch (error) {
          // Sign-in itself succeeded; the dashboard re-runs the sync on load.
          console.error("[auth] connection sync after OAuth callback failed", error);
        }
      }),
    },
    plugins: [
      apiKey({
        schema: { apikey: { modelName: "api_keys" } },
        defaultPrefix: API_KEY_PREFIX,
        // Enough of the key to recognize it in the dashboard ("sk_live_" + 6 chars).
        startingCharactersConfig: { shouldStore: true, charactersLength: API_KEY_PREFIX.length + 6 },
        enableMetadata: true,
        enableSessionForAPIKeys: false,
        permissions: { defaultPermissions: DEFAULT_API_KEY_PERMISSIONS },
        rateLimit: { enabled: true, timeWindow: 60_000, maxRequests: 120 },
      }),
      nextCookies(),
    ],
  });
}

type Auth = ReturnType<typeof createAuth>;

const globalForAuth = globalThis as typeof globalThis & { __signalKitAuth?: Auth };

/** Lazily created so builds and scripts without DATABASE_URL can import this module. */
export function getAuth(): Auth {
  globalForAuth.__signalKitAuth ??= createAuth();
  return globalForAuth.__signalKitAuth;
}

export async function getAuthSecretConfig() {
  const context = await getAuth().$context;
  return context.secretConfig;
}
