import { closeDb, getDb, initDatabase } from "@freeanima/core/db/pg";
import { initRedis } from "@freeanima/platform/connectors/redis";
import { runMigrations } from "@freeanima/core/db";
import {
  getConfiguredDatabaseUrlFromBootstrap,
  getConfiguredRedisUrlFromBootstrap,
  RuntimeConfigStore,
} from "@freeanima/platform/config";

import { loadBootstrapConfig } from "../config/bootstrap.ts";
import { bindRuntimeConfig } from "./config-phase.ts";
import { startupLog } from "./status.ts";

export type PersistencePhaseResult = {
  config: RuntimeConfigStore;
};

/** Phase 2: PG / Redis 连接、迁移、加载 RuntimeConfig */
export async function bootPersistencePhase(): Promise<PersistencePhaseResult> {
  const bootstrap = loadBootstrapConfig();
  const dbUrl = await getConfiguredDatabaseUrlFromBootstrap(bootstrap);
  if (!dbUrl) {
    throw new Error("database.url is required; PostgreSQL is the only supported backend");
  }
  initDatabase({ getDatabaseUrl: () => dbUrl });
  initRedis({
    getRedisUrl: () => getConfiguredRedisUrlFromBootstrap(bootstrap),
  });

  startupLog("Initializing PostgreSQL connection pool…");
  const db = getDb();
  await runMigrations(db);
  startupLog("Database migrations complete");

  startupLog("Loading runtime config from database…");
  const config = await RuntimeConfigStore.open();
  bindRuntimeConfig(config);

  return { config };
}

export { closeDb, getDb, initDatabase };
