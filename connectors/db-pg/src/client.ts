import { relations, type DbRelations } from "@freeanima/engine-db/schema";
import { drizzle as drizzleBun, type BunSQLDatabase } from "drizzle-orm/bun-sql/postgres";
import { drizzle as drizzlePostgres, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { SQL } from "bun";
import postgres from "postgres";
import { getDatabaseDriver } from "./driver.ts";

export interface DatabaseConfig {
  url: string;
}

export type DatabaseUrlResolver = () => string | null;

export type Db = PostgresJsDatabase<DbRelations> | BunSQLDatabase<DbRelations>;

export type SqlClient = postgres.Sql | SQL;

let databaseUrlResolver: DatabaseUrlResolver | null = null;
let sqlClient: SqlClient | null = null;
let dbInstance: Db | null = null;
let activeDriver: ReturnType<typeof getDatabaseDriver> = "postgres";

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

function createDb(url: string): Db {
  activeDriver = getDatabaseDriver();
  if (activeDriver === "bun") {
    const client = new SQL(url);
    sqlClient = client;
    return drizzleBun({ client, relations });
  }
  const client = postgres(url, { max: 10 });
  sqlClient = client;
  return drizzlePostgres({ client, relations });
}

export function getDb(): Db {
  if (dbInstance) return dbInstance;
  const dbCfg = getDatabaseConfig();
  if (!dbCfg?.url) {
    throw new Error("database.url 未配置");
  }
  dbInstance = createDb(dbCfg.url);
  return dbInstance;
}

export async function closeDb(): Promise<void> {
  if (!sqlClient) return;
  if (activeDriver === "bun") {
    (sqlClient as SQL).close();
  } else {
    await (sqlClient as postgres.Sql).end();
  }
  sqlClient = null;
  dbInstance = null;
  activeDriver = "postgres";
}

/** 测试 / 迁移脚本注入连接 */
export function setDbForTest(
  db: Db,
  client?: SqlClient,
  driver: ReturnType<typeof getDatabaseDriver> = getDatabaseDriver(),
): void {
  dbInstance = db;
  if (client) sqlClient = client;
  activeDriver = driver;
}

/** 测试 teardown：重置 resolver 与连接 */
export function resetDatabaseForTest(): void {
  databaseUrlResolver = null;
  sqlClient = null;
  dbInstance = null;
}

export { getDatabaseDriver } from "./driver.ts";
