import { relations, type DbRelations } from "@freeanima/core/db/schema";
import { drizzle, type BunSQLDatabase } from "drizzle-orm/bun-sql/postgres";
import { SQL } from "bun";

export interface DatabaseConfig {
  url: string;
}

export type DatabaseUrlResolver = () => string | null;

export type Db = BunSQLDatabase<DbRelations>;

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

function createDb(url: string): Db {
  const client = new SQL(url);
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
