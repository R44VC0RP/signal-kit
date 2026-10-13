import { existsSync, readFileSync } from "fs";
import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit bundles dotenv, which loads `.env` (production values) whenever DATABASE_URL
 * isn't already set, and `bun run` does not pass `.env.local` to child processes.
 * Read `.env.local` explicitly so local migrations can never fall through to production.
 * Containers have no `.env.local` and use the DATABASE_URL they were started with.
 */
function localDatabaseUrl() {
  if (!existsSync(".env.local")) {
    return undefined;
  }
  const line = readFileSync(".env.local", "utf8")
    .split("\n")
    .find((entry) => entry.startsWith("DATABASE_URL="));
  return line?.slice("DATABASE_URL=".length).trim().replace(/^['"]|['"]$/g, "");
}

const url = localDatabaseUrl() ?? process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is not set (and no .env.local provides one).");
}

export default defineConfig({
  // legacy-schema keeps the pre-Better Auth tables out of generated DROP statements.
  schema: ["./src/db/schema.ts", "./src/db/legacy-schema.ts"],
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: { url },
});
