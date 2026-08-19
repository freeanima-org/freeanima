import { createHash } from "node:crypto";

import { closeDb, getDb, initDatabase } from "@freeanima/habitat/core/db/pg";
import { abortOrphanAutoLlmRuns } from "@freeanima/habitat/core/db/pg/auto-llm-run";
import { formatPgStartupError } from "@freeanima/habitat/core/db/pg/startup-error.ts";
import { initRedis, withRedisLock } from "@freeanima/habitat/core/redis";
import { runMigrations } from "@freeanima/habitat/core/db";
import {
  getConfiguredDatabaseUrlFromBootstrap,
  getConfiguredRedisUrlFromBootstrap,
  RuntimeConfigStore,
} from "@freeanima/habitat/platform/config";

import { loadBootstrapConfig } from "../config/bootstrap.ts";
import { bindRuntimeConfig } from "./config-phase.ts";
import { startupLog } from "./status.ts";

export type PersistencePhaseResult = {
  config: RuntimeConfigStore;
};

const MIGRATE_LOCK_TTL_MS = 5 * 60 * 1000;
const MIGRATE_LOCK_WAIT_MS = 30_000;

/** 同库互斥；不同 database URL 可并行 migrate（CI 多隔离库） */
function migrateLockKey(databaseUrl: string): string {
  const hash = createHash("sha256").update(databaseUrl).digest("hex").slice(0, 16);
  return `db-migrate:${hash}`;
}

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
        key: migrateLockKey(dbUrl),
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

  try {
    const { aborted } = await abortOrphanAutoLlmRuns();
    if (aborted > 0) {
      startupLog(`Aborted ${String(aborted)} orphan AutoLlm run(s)`);
    }
  } catch (err) {
    startupLog(
      `abort orphan AutoLlm runs failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  startupLog("Loading runtime config from database…");
  const config = await RuntimeConfigStore.open();
  bindRuntimeConfig(config);

  return { config };
}

export { closeDb, getDb, initDatabase };
