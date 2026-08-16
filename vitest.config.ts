import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/**/*.ts"],
      exclude: ["src/cli.ts", "src/export.ts", "src/granola.ts", "src/types.ts"],
      all: true,
      // Actuals are ~98.8% lines / 91.3% branches. Branches gets a lower floor on purpose:
      // a uniform 90 would leave ~1pp of headroom and an unrelated PR would trip it.
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90,
      },
    },
    globals: true,
    restoreMocks: true,
  },
});
