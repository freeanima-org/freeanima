import { describe, it, expect, afterEach } from "bun:test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createTempDir, removeTempDir } from "@freeanima/habitat/core/util/temp-dir";
import { resolveMigrationsFolder, resolveMigrationsFolderForRun } from "./migrate.ts";
import { registerEmbeddedMigrations } from "./migrations-embedded.ts";

describe("resolveMigrationsFolder", () => {
  it("prefers repo-root migrations/ layout when it has SQL", () => {
    const root = createTempDir("freeanima-migrations-root-");
    try {
      const published = join(root, "migrations");
      const monorepo = join(root, "packages/habitat/core", "migrations");
      mkdirSync(join(published, "20260101000000_pub"), { recursive: true });
      writeFileSync(join(published, "20260101000000_pub", "migration.sql"), "SELECT 1;\n");
      mkdirSync(join(monorepo, "20260101000000_core"), { recursive: true });
      writeFileSync(join(monorepo, "20260101000000_core", "migration.sql"), "SELECT 1;\n");
      expect(resolveMigrationsFolder(root)).toBe(published);
    } finally {
      removeTempDir(root);
    }
  });

  it("ignores empty repo-root migrations/ and uses monorepo migrations", () => {
    const root = createTempDir("freeanima-migrations-root-");
    try {
      const published = join(root, "migrations");
      const monorepo = join(root, "packages/habitat/core", "migrations");
      mkdirSync(published, { recursive: true });
      mkdirSync(join(monorepo, "20260101000000_core"), { recursive: true });
      writeFileSync(join(monorepo, "20260101000000_core", "migration.sql"), "SELECT 1;\n");
      expect(resolveMigrationsFolder(root)).toBe(monorepo);
    } finally {
      removeTempDir(root);
    }
  });

  it("falls back to host/core/migrations in monorepo", () => {
    const root = createTempDir("freeanima-migrations-root-");
    try {
      const monorepo = join(root, "packages/habitat/core", "migrations");
      mkdirSync(monorepo, { recursive: true });
      expect(resolveMigrationsFolder(root)).toBe(monorepo);
    } finally {
      removeTempDir(root);
    }
  });
});

describe("resolveMigrationsFolderForRun", () => {
  const GLOBAL_KEY = "__FREEANIMA_EMBEDDED_MIGRATIONS__";
  const tempDirs: string[] = [];

  afterEach(() => {
    delete (globalThis as Record<string, unknown>)[GLOBAL_KEY];
    for (const dir of tempDirs.splice(0)) removeTempDir(dir);
  });

  it("prefers registered embedded migrations when present", () => {
    const src = createTempDir("freeanima-mig-embed-");
    tempDirs.push(src);
    const sqlPath = join(src, "migration.sql");
    writeFileSync(sqlPath, "SELECT 1;\n");
    registerEmbeddedMigrations([{ name: "20260101000000_embed", path: sqlPath }]);

    const folder = resolveMigrationsFolderForRun("/nonexistent-repo-root");
    tempDirs.push(folder);
    expect(existsSync(join(folder, "20260101000000_embed", "migration.sql"))).toBe(true);
  });
});
