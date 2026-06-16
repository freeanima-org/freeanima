import { existsSync } from "node:fs";
import { join } from "node:path";
import type { BunSQLDatabase } from "drizzle-orm/bun-sql/postgres";
import { getRepoRoot } from "../config/repo-root.ts";

/** migrations directory inside @freeanima/core (relative to this module) */
export const DEFAULT_MIGRATIONS_FOLDER = join(import.meta.dir, "../../migrations");

/** 已发布 @freeanima/cli: migrations/；Monorepo: core/migrations */
export function resolveMigrationsFolder(repoRoot = getRepoRoot()): string {
  const published = join(repoRoot, "migrations");
  if (existsSync(published)) return published;
  const monorepo = join(repoRoot, "core", "migrations");
  if (existsSync(monorepo)) return monorepo;
  return join(import.meta.dir, "../../migrations");
}

export type RunMigrationsOptions = {
  migrationsFolder?: string;
};

export async function runMigrations(
  db: BunSQLDatabase<any>,
  opts?: RunMigrationsOptions,
): Promise<void> {
  const migrationsFolder = opts?.migrationsFolder ?? resolveMigrationsFolder();
  const { migrate } = await import("drizzle-orm/bun-sql/postgres/migrator");
  await migrate(db, { migrationsFolder });
}
