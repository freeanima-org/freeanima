import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "kernel/hooks/vitest.config.mts",
  "kernel/kernel/vitest.config.mts",
  "packages/db/vitest.config.mts",
  "packages/kernel/vitest.config.mts",
  "packages/engine/vitest.config.mts",
  "packages/memory/vitest.config.mts",
  "packages/clarify/vitest.config.mts",
  "packages/runtime/vitest.config.mts",
  "packages/server/vitest.config.mts",
  "packages/gateway/vitest.config.mts",
  "packages/integrations/vitest.config.mts",
  "packages/tools/vitest.config.mts",
  "packages/api/vitest.config.mts",
  "apps/cli/vitest.config.mts",
]);
