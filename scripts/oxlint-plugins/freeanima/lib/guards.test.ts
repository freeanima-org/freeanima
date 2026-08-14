import { describe, expect, test } from "bun:test";

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
    expect(
      checkLayerDeps("packages/frontend/features/task/ui/a.ts", "@freeanima/client/portal-sdk"),
    ).toBeNull();
    expect(
      checkLayerDeps(
        "packages/frontend/features/task/ui/a.ts",
        "@freeanima/habitat/capabilities/tools",
      ),
    ).toMatch(/不得 import platform\/engine\/capabilities/);
  });

  test("shared cannot import host", () => {
    expect(
      checkLayerDeps("packages/shared/rpc-contract/x.ts", "@freeanima/habitat/core/util"),
    ).toMatch(/shared 不得 import habitat/);
    expect(
      checkLayerDeps("packages/shared/util/x.ts", "@freeanima/habitat/kernel/config-mechanism"),
    ).toMatch(/shared 不得 import habitat/);
    expect(checkLayerDeps("packages/shared/util/x.ts", "@freeanima/shared/db-shapes")).toBeNull();
  });

  test("host-kernel 仅可依赖 kernel 与 shared", () => {
    expect(
      checkLayerDeps(
        "packages/habitat/kernel/config-mechanism/config-store.ts",
        "@freeanima/shared/util/random-uuid.ts",
      ),
    ).toBeNull();
    expect(
      checkLayerDeps(
        "packages/habitat/kernel/config-mechanism/section-registry.ts",
        "@freeanima/habitat/core/config",
      ),
    ).toMatch(/habitat\/kernel/);
    expect(
      checkLayerDeps(
        "packages/habitat/core/config/config-store.ts",
        "@freeanima/habitat/kernel/config-mechanism",
      ),
    ).toBeNull();
  });

  test("feature-ui/client cannot import host/core/db or drizzle-orm", () => {
    expect(
      checkLayerDeps(
        "packages/frontend/features/task/ui/a.ts",
        "@freeanima/habitat/core/db/schema/entity",
      ),
    ).toMatch(/不得 import habitat\/core\/db/);
    expect(checkLayerDeps("packages/frontend/client/portal-sdk/a.ts", "drizzle-orm")).toMatch(
      /不得 import habitat\/core\/db/,
    );
    expect(
      checkLayerDeps("packages/frontend/features/task/ui/a.ts", "@freeanima/shared/entity-shapes"),
    ).toBeNull();
  });
});
