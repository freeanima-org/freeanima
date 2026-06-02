import type { ViteUserConfig } from "vitest/config";

/** 各 package vitest 共用：resolve、超时、重型依赖 inline（纯对象，供 mergeConfig 合并） */
export const vitestShared = {
  test: {
    testTimeout: 10_000,
    experimental: {
      fsModuleCache: true,
    },
    server: {
      deps: {
        inline: ["discord.js", "@freeanima/legacy-db", "postgres", "drizzle-orm"],
      },
    },
  },
  resolve: {
    conditions: ["import", "node"],
  },
} satisfies ViteUserConfig;
