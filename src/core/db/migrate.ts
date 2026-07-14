import { existsSync } from "node:fs";
import { join } from "node:path";
import type { BunSQLDatabase } from "drizzle-orm/bun-sql/postgres";
import type { DbRelations } from "@freeanima/core/db/schema";
import { getRepoRoot } from "../config/repo-root.ts";
import {
  getRegisteredEmbeddedMigrations,
  materializeEmbeddedMigrations,
} from "./migrations-embedded.ts";

/** migrations directory inside @freeanima/core (relative to this module) */
export const DEFAULT_MIGRATIONS_FOLDER = join(import.meta.dir, "../../migrations");

/** 旁路 migrations/（若存在）；否则 Monorepo `src/core/migrations`；standalone 优先走嵌入物化 */
export function resolveMigrationsFolder(repoRoot = getRepoRoot()): string {
  const sidecar = join(repoRoot, "migrations");
  if (existsSync(sidecar)) return sidecar;
  const monorepo = join(repoRoot, "src/core", "migrations");
  if (existsSync(monorepo)) return monorepo;
  return join(import.meta.dir, "../../migrations");
}

/** standalone 优先用编译嵌入的 migration.sql；否则走磁盘布局 */
export function resolveMigrationsFolderForRun(repoRoot = getRepoRoot()): string {
  const embedded = getRegisteredEmbeddedMigrations();
  if (embedded) return materializeEmbeddedMigrations(embedded);
  return resolveMigrationsFolder(repoRoot);
}

export type RunMigrationsOptions = {
  migrationsFolder?: string;
};

export async function runMigrations(
  db: BunSQLDatabase<DbRelations>,
  opts?: RunMigrationsOptions,
): Promise<void> {
  const migrationsFolder = opts?.migrationsFolder ?? resolveMigrationsFolderForRun();
  const { migrate } = await import("drizzle-orm/bun-sql/postgres/migrator");
  await migrate(db, { migrationsFolder });
}
