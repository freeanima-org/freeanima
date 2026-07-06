import { closeDb, getDb, initDatabase } from "@freeanima/core/db/pg";
import { initRedis } from "@freeanima/platform/connectors/redis";
import { runMigrations } from "@freeanima/core/db";
import {
  getConfiguredDatabaseUrl,
  getConfiguredRedisUrl,
  HybridConfig,
} from "@freeanima/platform/config";
import { pickBootstrapRecord } from "@freeanima/core/config";
import { loadConfigYamlRecord } from "../config/yaml-io.ts";
import { bootstrapConfigSchema } from "@freeanima/core/config";

import { bindRuntimeConfig } from "./config-phase.ts";
import { startupLog } from "./status.ts";

export type PersistencePhaseResult = {
  config: HybridConfig;
};

/** Phase 2: PG / Redis 连接、迁移、加载 HybridConfig */
export async function bootPersistencePhase(): Promise<PersistencePhaseResult> {
  const yamlRecord = loadConfigYamlRecord();
  const bootstrap = bootstrapConfigSchema.parse(pickBootstrapRecord(yamlRecord));
  const dbUrl = await getConfiguredDatabaseUrl(
    bootstrap as import("@freeanima/core/config").AnimaConfig,
  );
  if (!dbUrl) {
    throw new Error("database.url is required; PostgreSQL is the only supported backend");
  }
  initDatabase({ getDatabaseUrl: () => dbUrl });
  initRedis({
    getRedisUrl: () =>
      getConfiguredRedisUrl(bootstrap as import("@freeanima/core/config").AnimaConfig),
  });

  startupLog("Initializing PostgreSQL connection pool…");
  const db = getDb();
  await runMigrations(db);
  startupLog("Database migrations complete");

  startupLog("Loading runtime config from database…");
  const config = await HybridConfig.open();
  bindRuntimeConfig(config);

  return { config };
}

export { closeDb, getDb, initDatabase };
