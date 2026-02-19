import { readFileSync } from "node:fs";
import { defineConfig } from "tsup";

const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  banner: {
    js: "#!/usr/bin/env node",
  },
  clean: true,
  define: {
    __VERSION__: JSON.stringify(pkg.version),
  },
});
