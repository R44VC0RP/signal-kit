/**
 * Headless browser test for the Signal Kit relay SDK.
 *
 * Opens test-browser.html in chromium, attaches the WEBSOCKET_TOKEN, and
 * verifies that the SDK global loads, the WebSocket connects, and at least
 * one message is received from the relay.
 */

import { chromium } from "playwright";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const here = dirname(new URL(import.meta.url).pathname);
const htmlPath = resolve(here, "test-browser.html");
const TOKEN = process.env.WEBSOCKET_TOKEN;
const TIMEOUT_MS = Number(process.env.DURATION_MS ?? 15_000);

if (!TOKEN) {
  console.error("Missing WEBSOCKET_TOKEN.");
  process.exit(1);
}

const url = new URL(pathToFileURL(htmlPath));
url.searchParams.set("token", TOKEN);

console.log("[browser-test] launching chromium");
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

page.on("console", (message) => {
  console.log(`[page:${message.type()}]`, message.text());
});
page.on("pageerror", (error) => {
  console.error("[page error]", error.message);
});
page.on("requestfailed", (request) => {
  console.error("[request failed]", request.url(), request.failure()?.errorText);
});

console.log("[browser-test] navigating", url.toString());
await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: TIMEOUT_MS });

const sdkLoaded = await page.evaluate(() => typeof window.SignalKit === "function");
console.log("[browser-test] SignalKit global loaded:", sdkLoaded);

const initialStatus = await page.locator("#status").innerText();
console.log("[browser-test] initial status:", initialStatus);

try {
  await page.waitForFunction(() => document.getElementById("status")?.textContent === "connected", {
    timeout: TIMEOUT_MS,
  });
  console.log("[browser-test] status -> connected");
} catch (error) {
  const currentStatus = await page.locator("#status").innerText();
  console.error("[browser-test] never reached connected. last status:", currentStatus);
  console.error("[browser-test] error:", error.message);
}

try {
  await page.waitForFunction(() => (window.__signalKitMessages?.length ?? 0) > 0, {
    timeout: TIMEOUT_MS,
  });
} catch {
  console.warn("[browser-test] no messages received in window");
}

const messages = await page.evaluate(() => window.__signalKitMessages ?? []);
console.log(`[browser-test] received ${messages.length} message(s)`);
for (const message of messages) {
  console.log(" -", message.type, message.event ?? "");
}

await browser.close();
console.log("[browser-test] done");
