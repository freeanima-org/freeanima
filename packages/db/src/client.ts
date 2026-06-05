import { credential, loadConfig } from "@freeanima/legacy-kernel";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { relations, type DbRelations } from "./schema/index.ts";

export interface DatabaseConfig {
  url: string;
}

export type Db = PostgresJsDatabase<DbRelations>;

let sqlClient: postgres.Sql | null = null;
let dbInstance: Db | null = null;

/** 解析 pass: 前缀或直连 URL */
export function resolveDatabaseUrl(raw: string): string {
  if (raw.startsWith("pass:")) {
    const passPath = raw.slice("pass:".length);
    try {
      return credential(passPath, "url");
    } catch {
      return credential(passPath);
    }
  }
  return raw;
}

export function getDatabaseConfig(): DatabaseConfig | null {
  const cfg = loadConfig();
  const db = cfg.database;
  if (!db?.url) return null;
  return {
    url: resolveDatabaseUrl(db.url),
  };
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
