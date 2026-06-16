import { describe, it, expect } from "bun:test";
import { mkdirSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { resolveMigrationsFolder } from "./migrate.ts";

describe("resolveMigrationsFolder", () => {
  it("prefers published migrations/ layout", () => {
    const root = mkdtempSync(join(tmpdir(), "freeanima-migrations-root-"));
    const published = join(root, "migrations");
    const monorepo = join(root, "core", "migrations");
    mkdirSync(published, { recursive: true });
    mkdirSync(monorepo, { recursive: true });
    expect(resolveMigrationsFolder(root)).toBe(published);
  });

  it("falls back to core/migrations in monorepo", () => {
    const root = mkdtempSync(join(tmpdir(), "freeanima-migrations-root-"));
    const monorepo = join(root, "core", "migrations");
    mkdirSync(monorepo, { recursive: true });
    expect(resolveMigrationsFolder(root)).toBe(monorepo);
  });
});
