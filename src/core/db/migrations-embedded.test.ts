import { describe, it, expect, afterEach } from "bun:test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createTempDir, removeTempDir } from "@freeanima/core/util";
import {
  getRegisteredEmbeddedMigrations,
  materializeEmbeddedMigrations,
  registerEmbeddedMigrations,
} from "./migrations-embedded.ts";

describe("migrations-embedded", () => {
  const tempDirs: string[] = [];
  const GLOBAL_KEY = "__FREEANIMA_EMBEDDED_MIGRATIONS__";

  afterEach(() => {
    delete (globalThis as Record<string, unknown>)[GLOBAL_KEY];
    for (const dir of tempDirs.splice(0)) removeTempDir(dir);
  });

  it("registerEmbeddedMigrations exposes files on globalThis", () => {
    registerEmbeddedMigrations([{ name: "20260101000000_a", path: "/x/migration.sql" }]);
    expect(getRegisteredEmbeddedMigrations()).toEqual([
      { name: "20260101000000_a", path: "/x/migration.sql" },
    ]);
  });

  it("materializeEmbeddedMigrations writes migration.sql tree", () => {
    const src = createTempDir("freeanima-mig-src-");
    tempDirs.push(src);
    const sqlPath = join(src, "migration.sql");
    writeFileSync(sqlPath, "SELECT 1;\n");

    const dir = materializeEmbeddedMigrations([{ name: "20260101000000_probe", path: sqlPath }]);
    tempDirs.push(dir);

    const out = join(dir, "20260101000000_probe", "migration.sql");
    expect(existsSync(out)).toBe(true);
    expect(readFileSync(out, "utf8")).toBe("SELECT 1;\n");
    expect(existsSync(join(dir, ".ok"))).toBe(true);

    // 二次调用应复用同目录
    mkdirSync(join(dir, "should-remain"), { recursive: true });
    const again = materializeEmbeddedMigrations([{ name: "20260101000000_probe", path: sqlPath }]);
    expect(again).toBe(dir);
    expect(existsSync(join(dir, "should-remain"))).toBe(true);
  });
});
