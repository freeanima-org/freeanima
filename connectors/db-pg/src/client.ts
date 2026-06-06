import { relations, type DbRelations } from "@freeanima/engine-db/schema";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

export interface DatabaseConfig {
  url: string;
}

export type DatabaseUrlResolver = () => string | null;

export type Db = PostgresJsDatabase<DbRelations>;

let databaseUrlResolver: DatabaseUrlResolver | null = null;
let sqlClient: postgres.Sql | null = null;
let dbInstance: Db | null = null;

/** 由 service 层注入 database.url 解析（启动时调用一次） */
export function initDatabase(opts: { getDatabaseUrl: DatabaseUrlResolver }): void {
  databaseUrlResolver = opts.getDatabaseUrl;
}

export function getDatabaseConfig(): DatabaseConfig | null {
  const url = databaseUrlResolver?.() ?? null;
  if (!url) return null;
  return { url };
}

/** 已配置 database.url（L1 Session 使用 PostgreSQL） */
export function isPostgresPrimary(): boolean {
  return getDatabaseConfig() != null;
}

export function getDb(): Db {
  if (dbInstance) return dbInstance;
  const dbCfg = getDatabaseConfig();
  if (!dbCfg?.url) {
    throw new Error("database.url 未配置");
  }
  sqlClient = postgres(dbCfg.url, { max: 10 });
  dbInstance = drizzle({ client: sqlClient, relations });
  return dbInstance;
}

export async function closeDb(): Promise<void> {
  if (sqlClient) {
    await sqlClient.end();
    sqlClient = null;
    dbInstance = null;
  }
}

/** 测试 / 迁移脚本注入连接 */
export function setDbForTest(db: Db, client?: postgres.Sql): void {
  dbInstance = db;
  if (client) sqlClient = client;
}

/** 测试 teardown：重置 resolver 与连接 */
export function resetDatabaseForTest(): void {
  databaseUrlResolver = null;
  sqlClient = null;
  dbInstance = null;
}
