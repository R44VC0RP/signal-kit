import { createHash, randomBytes } from "crypto";

// Platform tokens are encrypted by Better Auth (see src/lib/connections/tokens.ts),
// and API keys are hashed by its api-key plugin.

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function stableJsonHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(sortObject(value))).digest("hex");
}

function sortObject(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortObject);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, sortObject(nested)]),
    );
  }
  return value;
}
