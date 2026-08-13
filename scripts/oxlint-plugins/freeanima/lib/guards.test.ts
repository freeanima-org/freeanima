import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { checkDirImport } from "./dir-import.ts";
import { checkImportDepth } from "./import-depth.ts";
import { checkLayerDeps } from "./layer-deps.ts";
import { findPgSqlArrayHits, isSafePgArrayBinding } from "./pg-sql-array.ts";
import { REPO_ROOT } from "./repo-path.ts";

describe("pg-sql-array helpers", () => {
  test("isSafePgArrayBinding", () => {
    expect(isSafePgArrayBinding("pgTextArray(ids)")).toBe(true);
    expect(isSafePgArrayBinding("sql`ARRAY[${v}]::text[]`")).toBe(true);
    expect(isSafePgArrayBinding("ids")).toBe(false);
    expect(isSafePgArrayBinding("[...ids]")).toBe(false);
  });

  test("findPgSqlArrayHits", () => {
    const bad = findPgSqlArrayHits("sql`x = ANY(${ids})`;\nsql`(b) ?| ${ids}`;");
    expect(bad.length).toBe(2);
    const good = findPgSqlArrayHits(
      "sql`x = ANY(${pgTextArray(ids)})`;\nsql`(b) ?| ${pgTextArray(ids)}`;",
    );
    expect(good.length).toBe(0);
  });
});

describe("repo-path", () => {
  test("REPO_ROOT has package.json", async () => {
    const pkg = Bun.file(`${REPO_ROOT}/package.json`);
    expect(await pkg.exists()).toBe(true);
  });
});

describe("dir-import", () => {
  test("missing dir errors; existing ok; web dist allow missing", () => {
    const tmp = mkdtempSync(join(tmpdir(), "fa-dir-"));
    try {
      const assets = join(tmp, "assets");
      mkdirSync(assets);
      writeFileSync(join(assets, ".keep"), "");
      const importer = join(tmp, "ok.ts");
      expect(checkDirImport(importer, "dir:./assets")).toBeNull();
      expect(checkDirImport(importer, "dir:./nope")).toMatch(/目录不存在/);
      const webImporter = join(REPO_ROOT, "src/portal/cli/web/x.ts");
      // 允许缺失的构建产物路径
      expect(checkDirImport(webImporter, "dir:../../app/web/dist")).toBeNull();
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe("import-depth", () => {
  test("depth and src ban", () => {
    expect(checkImportDepth("../../util.ts")).toBeNull();
    expect(checkImportDepth("../../../x.ts")).toMatch(/超过 2 级/);
    expect(checkImportDepth("../../../readme.md")).toBeNull();
    expect(checkImportDepth("../../src/foo.ts")).toMatch(/禁止相对路径/);
  });
});

describe("layer-deps", () => {
  test("feature-ui cannot import host capabilities", () => {
    expect(checkLayerDeps("src/features/task/ui/a.ts", "@freeanima/client/portal-sdk")).toBeNull();
    expect(
      checkLayerDeps("src/features/task/ui/a.ts", "@freeanima/host/capabilities/tools"),
    ).toMatch(/不得 import platform\/engine\/capabilities/);
  });
});
