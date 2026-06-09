import { existsSync } from "node:fs";
import { join } from "node:path";
import { getRepoRoot } from "@freeanima/service-config";
import type { BunSQLDatabase } from "drizzle-orm/bun-sql/postgres";

function resolveMigrationsFolder(): string {
  const fromRepo = join(getRepoRoot(), "migrations");
  if (existsSync(fromRepo)) return fromRepo;
  return join(import.meta.dir, "../migrations");
}

export async function runMigrations(db: BunSQLDatabase<any>): Promise<void> {
  const migrationsFolder = resolveMigrationsFolder();
  const { migrate } = await import("drizzle-orm/bun-sql/postgres/migrator");
  await migrate(db, { migrationsFolder });
}
