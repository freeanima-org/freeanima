/** PG 池连接在 `pg_stat_activity.application_name` 中的标识（毒连接探测用） */
export const PG_POOL_APP_NAME = "freeanima-habitat";

/** 独立监控连接，不经业务池，避免池饱和时 25P02 无法自检 */
export const PG_HEAL_APP_NAME = "freeanima-habitat-heal";

/** 默认连接寿命（秒）。长连接上 Bun SQL 预处理语句槽位会累积，回收可缩小 #30494 窗口 */
export const DEFAULT_PG_POOL_MAX_LIFETIME_SEC = 600;

/** 毒连接扫描间隔（毫秒）；`0` = 关闭 */
export const DEFAULT_PG_POOL_HEAL_INTERVAL_MS = 10_000;

export type PgPoolOptions = {
  max: number;
  idleTimeout: number;
  maxLifetime: number;
  healIntervalMs: number;
};

function parseNonNegInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === "") return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === "") return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * 与部署 PG max_connections 对齐的默认池；可通过环境变量覆盖。
 *
 * - idleTimeout 默认 0（关闭）：Bun ≤1.3.14 会在查询执行中误触
 *   ERR_POSTGRES_IDLE_TIMEOUT（oven-sh/bun#30646）
 * - maxLifetime 默认 600：周期性换连接，减轻预处理语句缓存串台窗口
 *   （oven-sh/bun#30494）；显式 `FREEANIMA_PG_POOL_MAX_LIFETIME=0` 关闭
 * - healIntervalMs 默认 10s：独立连接扫 `idle in transaction (aborted)` 并 ROLLBACK；
 *   `FREEANIMA_PG_POOL_HEAL_INTERVAL_MS=0` 关闭
 */
export function resolvePoolOptions(
  env: Record<string, string | undefined> = process.env,
): PgPoolOptions {
  return {
    max: parsePositiveInt(env.FREEANIMA_PG_POOL_MAX, 10),
    idleTimeout: parseNonNegInt(env.FREEANIMA_PG_POOL_IDLE_TIMEOUT, 0),
    maxLifetime: parseNonNegInt(
      env.FREEANIMA_PG_POOL_MAX_LIFETIME,
      DEFAULT_PG_POOL_MAX_LIFETIME_SEC,
    ),
    healIntervalMs: parseNonNegInt(
      env.FREEANIMA_PG_POOL_HEAL_INTERVAL_MS,
      DEFAULT_PG_POOL_HEAL_INTERVAL_MS,
    ),
  };
}
