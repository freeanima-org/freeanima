import type { RuntimeConfig } from "@freeanima/habitat/core/config";
import { resetResolvedWorldContextForTest } from "@freeanima/habitat/core/config/world-context";
import { resolveAndBindWorldContext } from "@freeanima/habitat/core/config/world-context-pg";
import { runMigrations } from "@freeanima/habitat/core/db";
import { closeDb, getDb, initDatabase } from "@freeanima/habitat/core/db/pg";

import { loadBootstrapConfig } from "../config/bootstrap.ts";
import { getConfiguredDatabaseUrlFromBootstrap } from "./database.ts";

export type WithPlatformDbOptions = {
  bindWorldContext?: boolean;
};

/** CLI 冷路径：内部 bootstrap 连 PG，回调仅接收 runtime */
export async function withPlatformDb<T>(
  fn: (runtime: RuntimeConfig) => Promise<T>,
  opts?: WithPlatformDbOptions,
): Promise<T> {
  const bootstrap = loadBootstrapConfig();
  const url = await getConfiguredDatabaseUrlFromBootstrap(bootstrap);
  if (!url) {
    throw new Error("database.url 未配置；请在 config.yaml 或 DATABASE_URL 中设置 PostgreSQL 连接");
  }
  initDatabase({ getDatabaseUrl: () => url });
  await runMigrations(getDb());
  const { RuntimeConfigStore } = await import("./runtime-config-store.ts");
  const store = await RuntimeConfigStore.open();
  if (opts?.bindWorldContext) {
    await resolveAndBindWorldContext(store.data);
  }
  try {
    return await fn(store.data);
  } finally {
    resetResolvedWorldContextForTest();
    await closeDb();
  }
}
