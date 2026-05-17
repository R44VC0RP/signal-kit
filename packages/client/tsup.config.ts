import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["esm", "cjs"],
    outExtension: ({ format }) => ({ js: format === "esm" ? ".js" : ".cjs" }),
    dts: true,
    clean: true,
    minify: false,
    sourcemap: true,
    splitting: false,
    target: "es2022",
    platform: "neutral",
  },
  {
    entry: ["src/index.ts"],
    format: ["iife"],
    globalName: "__SignalKitBundle",
    outExtension: () => ({ js: ".global.js" }),
    footer: {
      js: "globalThis.SignalKit = __SignalKitBundle.SignalKit; globalThis.SignalKitClient = __SignalKitBundle.SignalKit;",
    },
    clean: false,
    minify: false,
    sourcemap: true,
    splitting: false,
    target: "es2022",
    platform: "browser",
  },
]);
