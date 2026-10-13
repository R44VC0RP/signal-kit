import { randomBytes } from "crypto";

// Crockford base32, as used by ULID: lexicographic order == time order.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

let lastTime = 0;
let lastRandom: number[] = [];

/**
 * Monotonic ULID: 10 chars of millisecond time + 16 chars of randomness.
 * Within the same millisecond the random part is incremented, so ids from this process
 * always sort in creation order, which `since` replay relies on.
 */
export function newEventId(now = Date.now()) {
  if (now <= lastTime) {
    now = lastTime;
    increment(lastRandom);
  } else {
    lastTime = now;
    lastRandom = [...randomBytes(16)].map((byte) => byte % 32);
  }
  let time = "";
  let remaining = now;
  for (let i = 0; i < 10; i++) {
    time = ALPHABET[remaining % 32] + time;
    remaining = Math.floor(remaining / 32);
  }
  return time + lastRandom.map((digit) => ALPHABET[digit]).join("");
}

function increment(digits: number[]) {
  for (let i = digits.length - 1; i >= 0; i--) {
    if (digits[i] < 31) {
      digits[i] += 1;
      return;
    }
    digits[i] = 0;
  }
}

export function isEventId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9A-HJKMNP-TV-Z]{26}$/.test(value);
}
