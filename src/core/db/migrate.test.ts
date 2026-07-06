import { describe, it, expect } from "bun:test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { createTempDir, removeTempDir } from "@freeanima/core/util";
import { resolveMigrationsFolder } from "./migrate.ts";

describe("resolveMigrationsFolder", () => {
  it("prefers published migrations/ layout", () => {
    const root = createTempDir("freeanima-migrations-root-");
    try {
      const published = join(root, "migrations");
      const monorepo = join(root, "src/core", "migrations");
      mkdirSync(published, { recursive: true });
      mkdirSync(monorepo, { recursive: true });
      expect(resolveMigrationsFolder(root)).toBe(published);
    } finally {
      removeTempDir(root);
    }
  });

  it("falls back to core/migrations in monorepo", () => {
    const root = createTempDir("freeanima-migrations-root-");
    try {
      const monorepo = join(root, "src/core", "migrations");
      mkdirSync(monorepo, { recursive: true });
      expect(resolveMigrationsFolder(root)).toBe(monorepo);
    } finally {
      removeTempDir(root);
    }
  });
});
