import { relations, type DbRelations } from "@freeanima/core/db/schema";
import { drizzle, type BunSQLDatabase } from "drizzle-orm/bun-sql/postgres";
import { SQL } from "bun";

export interface DatabaseConfig {
  url: string;
}

export type DatabaseUrlResolver = () => string | null;

export type Db = BunSQLDatabase<DbRelations>;

/** `db.transaction` 回调内的客户端 */
export type DbTransaction = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** 顶层 Db 或事务客户端（insert/select 同一表面） */
export type DbSession = Db | DbTransaction;

export type SqlClient = SQL;

let databaseUrlResolver: DatabaseUrlResolver | null = null;
let sqlClient: SqlClient | null = null;
let dbInstance: Db | null = null;

/** database.url resolver injected by service layer (called once at startup) */
export function initDatabase(opts: { getDatabaseUrl: DatabaseUrlResolver }): void {
  databaseUrlResolver = opts.getDatabaseUrl;
}

export function getDatabaseConfig(): DatabaseConfig | null {
  const url = databaseUrlResolver?.() ?? null;
  if (!url) return null;
  return { url };
}

/** database.url configured (Slice A conversations use PostgreSQL) */
export function isPostgresPrimary(): boolean {
  return getDatabaseConfig() != null;
}

/**
 * 与部署 PG max_connections 对齐的默认池；可通过环境变量覆盖。
 *
 * idleTimeout 默认 0（关闭）：Bun ≤1.3.14 会在查询执行中误触
 * ERR_POSTGRES_IDLE_TIMEOUT（oven-sh/bun#30646），启动迁移 / HNSW 建索
 * / 大批量 backfill 超过 30s 时直接把 Service startup 打挂。
 * Bun 修好后可用 FREEANIMA_PG_POOL_IDLE_TIMEOUT=30 再打开。
 *
 * prepare 必须保持默认 true（Bun SQL）。`prepare: false` 时 jsonb / 复杂参数
 * 会被绑成 `[object Object]`，插入 entities.body 等列直接失败。
 * 并发下偶发 ERR_POSTGRES_UNSUPPORTED_INTEGER_SIZE（oven-sh/bun#16774）是另一类
 * 驱动竞态，不能用关 prepare 换；勿设 FREEANIMA_PG_PREPARE=0。
 */
function resolvePoolOptions(): {
  max: number;
  idleTimeout: number;
  maxLifetime: number;
} {
  const maxRaw = Number.parseInt(process.env.FREEANIMA_PG_POOL_MAX ?? "", 10);
  const idleRaw = Number.parseInt(process.env.FREEANIMA_PG_POOL_IDLE_TIMEOUT ?? "", 10);
  const lifetimeRaw = Number.parseInt(process.env.FREEANIMA_PG_POOL_MAX_LIFETIME ?? "", 10);
  return {
    max: Number.isFinite(maxRaw) && maxRaw > 0 ? maxRaw : 10,
    idleTimeout: Number.isFinite(idleRaw) && idleRaw >= 0 ? idleRaw : 0,
    maxLifetime: Number.isFinite(lifetimeRaw) && lifetimeRaw >= 0 ? lifetimeRaw : 0,
  };
}

function createDb(url: string): Db {
  const pool = resolvePoolOptions();
  const client = new SQL({
    url,
    max: pool.max,
    idleTimeout: pool.idleTimeout,
    maxLifetime: pool.maxLifetime,
  });
  sqlClient = client;
  return drizzle({ client, relations });
}

export function getDb(): Db {
  if (dbInstance) return dbInstance;
  const dbCfg = getDatabaseConfig();
  if (!dbCfg?.url) {
    throw new Error("database.url not configured");
  }
  dbInstance = createDb(dbCfg.url);
  return dbInstance;
}

export async function closeDb(): Promise<void> {
  if (!sqlClient) return;
  void sqlClient.close();
  sqlClient = null;
  dbInstance = null;
}

/** Inject connection for tests / migration scripts */
export function setDbForTest(db: Db, client?: SqlClient): void {
  dbInstance = db;
  if (client) sqlClient = client;
}

/** Test teardown: reset resolver and connection */
export function resetDatabaseForTest(): void {
  databaseUrlResolver = null;
  sqlClient = null;
  dbInstance = null;
}
