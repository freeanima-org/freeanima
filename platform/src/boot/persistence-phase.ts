import { closeDb, getDb, initDatabase } from "@freeanima/core/db/pg";
import { initRedis } from "@freeanima/platform/connectors/redis";
import { runMigrations } from "@freeanima/core/db";
import { getConfiguredDatabaseUrl, getConfiguredRedisUrl } from "@freeanima/platform/config";
import type { FileConfig } from "@freeanima/platform/config";

import { startupLog } from "./status.ts";

export type PersistencePhaseResult = Record<string, never>;

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

  return {};
}

export { closeDb, getDb, initDatabase };
