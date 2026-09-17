import { SQL } from "bun";
import { isRecord } from "@freeanima/shared/util";

import { logPgComponent } from "./log.ts";
import {
  PG_HEAL_APP_NAME,
  PG_POOL_APP_NAME,
  resolvePoolOptions,
  type PgPoolOptions,
} from "./pool-options.ts";

export type PoolHealDeps = {
  getPool: () => SQL | null;
  createMonitor: () => SQL;
  getPoolMax: () => number;
};

export type PoolHealTickResult = {
  aborted: number;
  rolled_back: number;
  skipped: boolean;
};

let healTimer: ReturnType<typeof setInterval> | null = null;
let healRunning = false;
let monitorClient: SQL | null = null;
let lastOptions: PgPoolOptions | null = null;

function readAbortedCount(rows: unknown): number {
  if (!Array.isArray(rows) || rows.length === 0) return 0;
  const row: unknown = rows[0];
  if (!isRecord(row)) return 0;
  const raw: unknown = row["n"];
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

async function countAbortedPoolBackends(monitor: SQL): Promise<number> {
  const rows: unknown = await monitor`
    SELECT count(*)::int AS n
    FROM pg_stat_activity
    WHERE application_name = ${PG_POOL_APP_NAME}
      AND state = 'idle in transaction (aborted)'
  `;
  return readAbortedCount(rows);
}

/**
 * 预留池内连接并逐个 ROLLBACK，清掉 `idle in transaction (aborted)`。
 * 必须在 finally 里 release，勿丢弃未 settle 的 reserve（Bun #39451）。
 */
export async function drainPoolWithRollback(pool: SQL, max: number): Promise<number> {
  const reservations: Array<Awaited<ReturnType<SQL["reserve"]>>> = [];
  let rolled = 0;
  try {
    for (let i = 0; i < max; i++) {
      try {
        reservations.push(await pool.reserve());
      } catch {
        break;
      }
    }
    for (const reserved of reservations) {
      try {
        await reserved.unsafe("ROLLBACK");
        rolled += 1;
      } catch {
        /* 健康连接 ROLLBACK 也可能 NOTICE；失败仍释放 */
      }
    }
  } finally {
    for (const reserved of reservations) {
      try {
        reserved.release();
      } catch {
        /* ignore */
      }
    }
  }
  return rolled;
}

export async function runPoolHealTick(deps: PoolHealDeps): Promise<PoolHealTickResult> {
  const pool = deps.getPool();
  if (!pool) {
    return { aborted: 0, rolled_back: 0, skipped: true };
  }

  const monitor = deps.createMonitor();
  let aborted = 0;
  try {
    aborted = await countAbortedPoolBackends(monitor);
  } catch (err) {
    logPgComponent("pg-pool-heal").warn("pg_stat_activity probe failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return { aborted: 0, rolled_back: 0, skipped: true };
  }

  if (aborted <= 0) {
    return { aborted: 0, rolled_back: 0, skipped: false };
  }

  logPgComponent("pg-pool-heal").warn("poisoned pool backends detected; draining with ROLLBACK", {
    aborted,
    application_name: PG_POOL_APP_NAME,
  });

  const rolled_back = await drainPoolWithRollback(pool, deps.getPoolMax());
  logPgComponent("pg-pool-heal").info("pool drain complete", { aborted, rolled_back });
  return { aborted, rolled_back, skipped: false };
}

function clearHealTimer(): void {
  if (healTimer != null) {
    clearInterval(healTimer);
    healTimer = null;
  }
  healRunning = false;
}

function ensureMonitor(url: string): SQL {
  if (monitorClient) return monitorClient;
  monitorClient = new SQL({
    url,
    max: 1,
    idleTimeout: 0,
    maxLifetime: 0,
    connection: { application_name: PG_HEAL_APP_NAME },
  });
  return monitorClient;
}

async function closeMonitor(): Promise<void> {
  if (!monitorClient) return;
  const client = monitorClient;
  monitorClient = null;
  try {
    await client.close({ timeout: 2 });
  } catch {
    /* ignore */
  }
}

/**
 * 启动毒连接回收循环。须在业务池已创建后调用；`healIntervalMs=0` 为 no-op。
 */
export function startPgPoolHealer(opts: {
  getPool: () => SQL | null;
  databaseUrl: string;
  poolOptions?: PgPoolOptions;
}): void {
  clearHealTimer();
  const prevMonitor = monitorClient;
  monitorClient = null;
  if (prevMonitor) {
    void prevMonitor.close({ timeout: 2 }).catch(() => undefined);
  }

  const poolOptions = opts.poolOptions ?? resolvePoolOptions();
  lastOptions = poolOptions;
  if (poolOptions.healIntervalMs <= 0) return;

  const deps: PoolHealDeps = {
    getPool: opts.getPool,
    createMonitor: () => ensureMonitor(opts.databaseUrl),
    getPoolMax: () => lastOptions?.max ?? resolvePoolOptions().max,
  };

  const tick = (): void => {
    if (healRunning) return;
    healRunning = true;
    void runPoolHealTick(deps)
      .catch((err: unknown) => {
        logPgComponent("pg-pool-heal").warn("heal tick failed", {
          error: err instanceof Error ? err.message : String(err),
        });
      })
      .finally(() => {
        healRunning = false;
      });
  };

  healTimer = setInterval(tick, poolOptions.healIntervalMs);
  if (typeof healTimer === "object" && "unref" in healTimer) {
    healTimer.unref();
  }
}

export async function stopPgPoolHealer(): Promise<void> {
  clearHealTimer();
  lastOptions = null;
  await closeMonitor();
}
