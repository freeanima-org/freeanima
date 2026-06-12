import { closeDb, createPgRepositories, getDb, initDatabase } from "@freeanima/connectors-db-pg";
import { initRedis } from "@freeanima/connectors-redis";
import { runMigrations } from "@freeanima/core/db";
import { getConfiguredDatabaseUrl, getConfiguredRedisUrl } from "@freeanima/service-config";
import type { FileConfig } from "@freeanima/service-config";
import type { PgRepositories } from "@freeanima/core/repos";

import { startupLog } from "./status.ts";

export type PersistencePhaseResult = {
  repos: PgRepositories;
};

/** Phase 2: PG / Redis 连接与迁移 */
export async function bootPersistencePhase(config: FileConfig): Promise<PersistencePhaseResult> {
  const dbUrl = await getConfiguredDatabaseUrl(config.data);
  if (!dbUrl) {
    throw new Error("database.url is required; PostgreSQL is the only supported backend");
  }
  initDatabase({ getDatabaseUrl: () => dbUrl });
  initRedis({ getRedisUrl: () => getConfiguredRedisUrl(config.data) });

  startupLog("Initializing PostgreSQL connection pool…");
  const db = getDb();
  await runMigrations(db);
  startupLog("Database migrations complete");
  const repos = createPgRepositories({ getDb });

  return { repos };
}

export { closeDb };
