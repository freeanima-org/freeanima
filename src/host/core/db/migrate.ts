import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { BunSQLDatabase } from "drizzle-orm/bun-sql/postgres";
import type { DbRelations } from "@freeanima/host/core/db/schema";
import { getRepoRoot } from "../config/repo-root.ts";
import {
  getRegisteredEmbeddedMigrations,
  materializeEmbeddedMigrations,
} from "./migrations-embedded.ts";

/** migrations 目录：相对本模块 → `src/host/core/migrations` */
export const DEFAULT_MIGRATIONS_FOLDER = join(import.meta.dir, "../migrations");

/** 旁路目录须真有 migration.sql，避免空 migrations/ 抢路导致 migrate 空跑 */
function hasMigrationSqlFiles(dir: string): boolean {
  if (!existsSync(dir)) return false;
  try {
    for (const name of readdirSync(dir)) {
      if (existsSync(join(dir, name, "migration.sql"))) return true;
    }
  } catch {
    return false;
  }
  return false;
}

/** 旁路 migrations/（含 SQL）；否则 Monorepo `src/host/core/migrations`；standalone 优先走嵌入物化 */
export function resolveMigrationsFolder(repoRoot = getRepoRoot()): string {
  const sidecar = join(repoRoot, "migrations");
  if (hasMigrationSqlFiles(sidecar)) return sidecar;
  const monorepo = join(repoRoot, "src/host/core", "migrations");
  if (hasMigrationSqlFiles(monorepo) || existsSync(monorepo)) return monorepo;
  return DEFAULT_MIGRATIONS_FOLDER;
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
