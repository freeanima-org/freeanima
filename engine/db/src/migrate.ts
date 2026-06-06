import { join } from "node:path";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

export async function runMigrations(db: PostgresJsDatabase<any>): Promise<void> {
  const migrationsFolder = join(import.meta.dir, "../migrations");
  await migrate(db, { migrationsFolder });
}
