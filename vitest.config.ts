import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/core/types.ts", "src/platform/silence-asset.ts"],
      thresholds: {
        lines: 95,
      },
    },
  },
});
