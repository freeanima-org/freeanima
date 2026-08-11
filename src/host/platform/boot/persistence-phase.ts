import { closeDb, getDb, initDatabase } from "@freeanima/host/core/db/pg";
import { formatPgStartupError } from "@freeanima/host/core/db/pg/startup-error.ts";
import { initRedis, withRedisLock } from "@freeanima/host/core/redis";
import { runMigrations } from "@freeanima/host/core/db";
import {
  getConfiguredDatabaseUrlFromBootstrap,
  getConfiguredRedisUrlFromBootstrap,
  RuntimeConfigStore,
} from "@freeanima/host/platform/config";

import { loadBootstrapConfig } from "../config/bootstrap.ts";
import { bindRuntimeConfig } from "./config-phase.ts";
import { startupLog } from "./status.ts";

export type PersistencePhaseResult = {
  config: RuntimeConfigStore;
};

const MIGRATE_LOCK_TTL_MS = 5 * 60 * 1000;
const MIGRATE_LOCK_WAIT_MS = 30_000;

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
  try {
    const db = getDb();
    const locked = await withRedisLock(
      {
        key: "db-migrate",
        ttlMs: MIGRATE_LOCK_TTL_MS,
        mode: "wait",
        waitMs: MIGRATE_LOCK_WAIT_MS,
      },
      async () => {
        await runMigrations(db);
      },
    );
    if (locked.status === "busy") {
      throw new Error(
        "database migration lock busy: another Habitat is migrating (waited 30s); retry boot",
      );
    }
  } catch (err) {
    throw formatPgStartupError(err, { databaseUrl: dbUrl });
  }
  startupLog("Database migrations complete");

  startupLog("Loading runtime config from database…");
  const config = await RuntimeConfigStore.open();
  bindRuntimeConfig(config);

  return { config };
}

export { closeDb, getDb, initDatabase };
