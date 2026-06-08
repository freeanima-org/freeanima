import { join } from "node:path";
import type { BunSQLDatabase } from "drizzle-orm/bun-sql/postgres";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

function useBunSqlDriver(): boolean {
  return process.env.DATABASE_DRIVER?.trim().toLowerCase() === "bun";
}

export async function runMigrations(
  db: PostgresJsDatabase<any> | BunSQLDatabase<any>,
): Promise<void> {
  const migrationsFolder = join(import.meta.dir, "../migrations");
  if (useBunSqlDriver()) {
    const { migrate } = await import("drizzle-orm/bun-sql/postgres/migrator");
    await migrate(db as BunSQLDatabase<any>, { migrationsFolder });
    return;
  }
  const { migrate } = await import("drizzle-orm/postgres-js/migrator");
  await migrate(db as PostgresJsDatabase<any>, { migrationsFolder });
}
