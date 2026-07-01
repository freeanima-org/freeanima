import { describe, expect, test } from "bun:test";

import { parseLayoutModeOverride, resolveLayoutMode } from "../app/src/layout-mode.ts";

describe("resolveLayoutMode", () => {
  test("Electron 始终 expanded", () => {
    expect(resolveLayoutMode({ isElectron: true, isCapacitor: true })).toBe("expanded");
  });

  test("Capacitor 为 compact", () => {
    expect(resolveLayoutMode({ isCapacitor: true })).toBe("compact");
  });

  test("手机浏览器触屏窄屏为 compact", () => {
    expect(resolveLayoutMode({ isCoarsePointer: true, isNarrowViewport: true })).toBe("compact");
  });

  test("桌面宽屏默认 expanded", () => {
    expect(resolveLayoutMode({ isCoarsePointer: false, isNarrowViewport: false })).toBe("expanded");
  });

  test("PWA standalone 为 compact", () => {
    expect(resolveLayoutMode({ isStandalonePwa: true })).toBe("compact");
  });

  test("URL layout 覆盖优先", () => {
    expect(resolveLayoutMode({ layoutOverride: "expanded", isCapacitor: true })).toBe("expanded");
  });
});

describe("parseLayoutModeOverride", () => {
  test("解析别名", () => {
    expect(parseLayoutModeOverride("mobile")).toBe("compact");
    expect(parseLayoutModeOverride("desktop")).toBe("expanded");
  });
});
