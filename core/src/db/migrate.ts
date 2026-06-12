import { join } from "node:path";
import type { BunSQLDatabase } from "drizzle-orm/bun-sql/postgres";

/** migrations directory inside storage-db package (relative to this module) */
export const DEFAULT_MIGRATIONS_FOLDER = join(import.meta.dir, "../../migrations");

export type RunMigrationsOptions = {
  migrationsFolder?: string;
};

export async function runMigrations(
  db: BunSQLDatabase<any>,
  opts?: RunMigrationsOptions,
): Promise<void> {
  const migrationsFolder = opts?.migrationsFolder ?? DEFAULT_MIGRATIONS_FOLDER;
  const { migrate } = await import("drizzle-orm/bun-sql/postgres/migrator");
  await migrate(db, { migrationsFolder });
}
