import { describe, expect, test } from "bun:test";

import { retiredBy, scanRetiredSpecifiers } from "./retired-imports.ts";

describe("retired-imports", () => {
  test("退役前缀识别", () => {
    expect(retiredBy("@freeanima/host/core/db")).toBe("@freeanima/host/");
    expect(retiredBy("@freeanima/habitat/core/util")).toBe("@freeanima/habitat/");
    expect(retiredBy("@freeanima/shared/entity-shapes")).toBe("@freeanima/shared/entity-shapes");
    expect(retiredBy("@freeanima/shared/db-shapes")).toBe("@freeanima/shared/db-shapes");
    expect(retiredBy("@freeanima/core/util")).toBeNull();
    expect(retiredBy("@freeanima/capabilities/ports")).toBeNull();
    expect(retiredBy("@freeanima/shared/pg-shapes")).toBeNull();
  });

  test("退役前缀不误伤目标包", () => {
    expect(retiredBy("@freeanima/kernel/logging")).toBeNull();
    expect(retiredBy("@freeanima/features/task/habitat/routes/index.ts")).toBeNull();
    expect(retiredBy("@freeanima/portal/app/web")).toBeNull();
  });

  test("正则形式的退役模式", () => {
    expect(retiredBy("@freeanima/features/task/habitat/method-defs.ts")).not.toBeNull();
    expect(retiredBy("@freeanima/features/object-storage/habitat/method-defs.ts")).not.toBeNull();
    expect(retiredBy("@freeanima/engine/loop")).not.toBeNull();
    expect(retiredBy("@freeanima/engine/loop-mechanism")).toBeNull();
    expect(retiredBy("@freeanima/kernel/loop-mechanism")).not.toBeNull();
  });

  test("扫描静态 import / export-from / 动态 import", () => {
    const source = [
      'import type { X } from "@freeanima/shared/entity-shapes";',
      'export * from "@freeanima/shared/db-shapes";',
      'const y = await import("@freeanima/engine/loop");',
      'import { ok } from "@freeanima/shared/util";',
    ].join("\n");
    expect(scanRetiredSpecifiers(source)).toEqual([
      "@freeanima/shared/entity-shapes",
      "@freeanima/shared/db-shapes",
      "@freeanima/engine/loop",
    ]);
  });

  test("同一说明符只报一次", () => {
    const source = [
      'import { a } from "@freeanima/host/core/db";',
      'import { b } from "@freeanima/host/core/db";',
    ].join("\n");
    expect(scanRetiredSpecifiers(source)).toEqual(["@freeanima/host/core/db"]);
  });

  test("干净源码无命中", () => {
    expect(scanRetiredSpecifiers('import { x } from "@freeanima/kernel/logging";')).toEqual([]);
  });
});
