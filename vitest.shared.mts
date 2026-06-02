import { defineConfig } from "vitest/config";

/** 各 package vitest 共用：resolve、超时、重型依赖 inline */
export const vitestShared = defineConfig({
  test: {
    testTimeout: 10_000,
    experimental: {
      fsModuleCache: true,
    },
  },
  resolve: {
    conditions: ["import", "node"],
  },
  server: {
    deps: {
      inline: ["discord.js", "@freeanima/legacy-db", "postgres", "drizzle-orm"],
    },
  },
});
