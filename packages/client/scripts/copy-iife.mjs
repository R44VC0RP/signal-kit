import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const here = dirname(new URL(import.meta.url).pathname);
const distDir = resolve(here, "..", "dist");
const publicDir = resolve(here, "..", "..", "..", "public");

await mkdir(publicDir, { recursive: true });

const jsSource = await readFile(resolve(distDir, "index.global.js"), "utf8");
const rewritten = jsSource.replace(
  /\/\/# sourceMappingURL=index\.global\.js\.map/g,
  "//# sourceMappingURL=twe-client.js.map",
);
await writeFile(resolve(publicDir, "twe-client.js"), rewritten);
await copyFile(resolve(distDir, "index.global.js.map"), resolve(publicDir, "twe-client.js.map"));

console.log("Copied SDK IIFE bundle to public/twe-client.js");
