import { defineConfig } from "vitest/config";

/** 根入口：默认 workspace；`pnpm test:all` / `pnpm test:watch` 跑全仓 */
export default defineConfig({
  test: {
    workspace: "vitest.workspace.mts",
  },
});
