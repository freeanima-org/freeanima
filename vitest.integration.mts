import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    conditions: ["import", "node"],
  },
  server: {
    deps: {
      inline: ["discord.js", "@freeanima/legacy-db", "postgres", "drizzle-orm"],
    },
  },
  test: {
    include: ["packages/**/tests/integration/**/*.test.ts"],
    globalSetup: ["./scripts/vitest-pg-global-setup.ts"],
    setupFiles: ["./scripts/vitest-pg-setup-files.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    maxWorkers: 1,
  },
});
