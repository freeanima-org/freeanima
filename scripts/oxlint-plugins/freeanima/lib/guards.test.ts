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
  test("ui-features 只能依赖 portal-sdk / ui-kit / shared", () => {
    expect(checkLayerDeps("packages/ui-features/task/ui/a.ts", "@freeanima/portal-sdk")).toBeNull();
    expect(
      checkLayerDeps("packages/ui-features/task/ui/a.ts", "@freeanima/capabilities/tools"),
    ).toMatch(/ui-features 不得依赖 capabilities/);
  });

  test("shared 是叶层", () => {
    expect(checkLayerDeps("packages/shared/rpc-contract/x.ts", "@freeanima/core/util")).toMatch(
      /shared 不得依赖 core/,
    );
    expect(
      checkLayerDeps("packages/shared/util/x.ts", "@freeanima/kernel/config-mechanism"),
    ).toMatch(/shared 不得依赖 kernel/);
    expect(checkLayerDeps("packages/shared/util/x.ts", "@freeanima/shared/pg-shapes")).toBeNull();
  });

  test("kernel 仅可依赖 shared", () => {
    expect(
      checkLayerDeps(
        "packages/kernel/config-mechanism/config-store.ts",
        "@freeanima/shared/util/random-uuid.ts",
      ),
    ).toBeNull();
    expect(
      checkLayerDeps(
        "packages/kernel/config-mechanism/section-registry.ts",
        "@freeanima/core/config",
      ),
    ).toMatch(/kernel 不得依赖 core/);
    expect(
      checkLayerDeps("packages/core/config/config-store.ts", "@freeanima/kernel/config-mechanism"),
    ).toBeNull();
  });

  test("core 不得依赖 engine/capabilities/server", () => {
    expect(checkLayerDeps("packages/core/llm/x.ts", "@freeanima/capabilities/memory")).toMatch(
      /core 不得依赖 capabilities/,
    );
    expect(checkLayerDeps("packages/core/llm/x.ts", "@freeanima/server/service/x.ts")).toMatch(
      /core 不得依赖 server/,
    );
    expect(checkLayerDeps("packages/core/llm/x.ts", "@freeanima/engine/conversation")).toMatch(
      /core 不得依赖 engine/,
    );
  });

  test("相对路径同样受约束（旧实现的漏洞）", () => {
    expect(checkLayerDeps("packages/core/llm/x.ts", "../../server/service/app-runtime.ts")).toMatch(
      /core 不得依赖 server/,
    );
    expect(checkLayerDeps("packages/core/llm/x.ts", "../config/index.ts")).toBeNull();
    expect(
      checkLayerDeps("packages/capabilities/tools/x.ts", "../../features/task/domain/a.ts"),
    ).toMatch(/capabilities 不得依赖 features/);
  });

  test("前端层不得 import drizzle-orm / core db", () => {
    expect(
      checkLayerDeps("packages/ui-features/task/ui/a.ts", "@freeanima/core/db/schema/entity"),
    ).toMatch(/不得 import drizzle-orm 或 core\/db/);
    expect(checkLayerDeps("packages/portal-sdk/a.ts", "drizzle-orm")).toMatch(
      /不得 import drizzle-orm 或 core\/db/,
    );
    expect(
      checkLayerDeps("packages/ui-features/task/ui/a.ts", "@freeanima/shared/pg-shapes/entity"),
    ).toBeNull();
  });

  test("server 不得 import 前端层", () => {
    expect(checkLayerDeps("packages/server/x.ts", "@freeanima/portal-sdk/a.ts")).toMatch(
      /server 不得依赖 portal-sdk/,
    );
    expect(checkLayerDeps("packages/server/x.ts", "@freeanima/ui-kit")).toMatch(
      /server 不得依赖 ui-kit/,
    );
  });

  test("构建工具链文件不参与 DAG 判定", () => {
    expect(
      checkLayerDeps(
        "packages/ui-features/coding/vite.config.ts",
        "@freeanima/app-frame/vite/satellite-vite.ts",
      ),
    ).toBeNull();
    expect(
      checkLayerDeps(
        "packages/ui-features/companion/build.ts",
        "@freeanima/app-frame/vite/satellite-vite.ts",
      ),
    ).toBeNull();
    expect(
      checkLayerDeps("packages/app-frame/vite.config.ts", "@freeanima/portal/app/web/x.ts"),
    ).toBeNull();
    // 同目录的非构建文件仍受约束
    expect(
      checkLayerDeps(
        "packages/ui-features/coding/domain/x.ts",
        "@freeanima/app-frame/vite/run-build.ts",
      ),
    ).toMatch(/ui-features 不得依赖 app-frame/);
  });

  test("非 packages 路径不参与判定", () => {
    expect(checkLayerDeps("scripts/foo.ts", "@freeanima/core/util")).toBeNull();
    expect(checkLayerDeps("tests/integration/x.test.ts", "@freeanima/core/util")).toBeNull();
  });
});
