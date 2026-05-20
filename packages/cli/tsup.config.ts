import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  minify: false,
  sourcemap: true,
  splitting: false,
  target: "es2022",
  platform: "node",
  banner: {
    js: "#!/usr/bin/env node",
  },
});
