import { describe, expect, test } from "bun:test";

import { retiredBy, rewriteSource, rewriteSpecifier } from "./import-rewrites.ts";

describe("import-rewrites", () => {
  test("前缀替换保留尾部", () => {
    expect(rewriteSpecifier("@freeanima/shared/entity-shapes")).toBe(
      "@freeanima/shared/pg-shapes/entity",
    );
    expect(rewriteSpecifier("@freeanima/shared/entity-shapes/component-ids.ts")).toBe(
      "@freeanima/shared/pg-shapes/entity/component-ids.ts",
    );
    expect(rewriteSpecifier("@freeanima/habitat/engine/loop")).toBe(
      "@freeanima/habitat/kernel/loop-mechanism",
    );
    expect(rewriteSpecifier("@freeanima/shared/pg-shapes")).toBeNull();
  });

  test("退役前缀识别", () => {
    expect(retiredBy("@freeanima/host/core/db")).toBe("@freeanima/host/");
    expect(retiredBy("@freeanima/habitat/core/util")).toBeNull();
    expect(retiredBy("@freeanima/shared/entity-shapes")).toBe("@freeanima/shared/entity-shapes");
  });

  test("改写静态 import / export-from / 动态 import", () => {
    const source = [
      'import type { X } from "@freeanima/shared/entity-shapes";',
      'export * from "@freeanima/shared/db-shapes";',
      'const y = await import("@freeanima/habitat/engine/loop");',
      'import { ok } from "@freeanima/shared/util";',
    ].join("\n");
    const { next, pending, retired } = rewriteSource(source);
    expect(next).toContain('"@freeanima/shared/pg-shapes/entity"');
    expect(next).toContain('"@freeanima/shared/pg-shapes"');
    expect(next).toContain('"@freeanima/habitat/kernel/loop-mechanism"');
    expect(next).toContain('"@freeanima/shared/util"');
    expect(pending).toHaveLength(3);
    expect(retired).toHaveLength(0);
  });

  test("P1：feature method-defs 上提到契约层", () => {
    expect(rewriteSpecifier("@freeanima/features/task/habitat/method-defs.ts")).toBe(
      "@freeanima/shared/rpc-contract/feature-rpc/methods/task.ts",
    );
    expect(rewriteSpecifier("@freeanima/features/object-storage/habitat/method-defs.ts")).toBe(
      "@freeanima/shared/rpc-contract/feature-rpc/methods/object-storage.ts",
    );
    expect(rewriteSpecifier("@freeanima/features/task/habitat/routes/index.ts")).toBeNull();
    expect(retiredBy("@freeanima/features/task/habitat/method-defs.ts")).not.toBeNull();
  });

  test("未覆盖的退役前缀进入 retired 清单", () => {
    const { pending, retired } = rewriteSource('import x from "@freeanima/host/core/db";');
    expect(pending).toHaveLength(0);
    expect(retired).toEqual(["@freeanima/host/core/db"]);
  });
});
