import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    restoreMocks: true,
    mockReset: true,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/lib/types.ts"],
      reporter: ["text", "html"],
      reportsDirectory: "coverage",
    },
  },
});
