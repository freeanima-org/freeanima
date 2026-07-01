import { describe, expect, test } from "bun:test";

import { parseLayoutModeOverride, resolveLayoutMode } from "../app/src/layout-mode.ts";

describe("resolveLayoutMode", () => {
  test("Electron 始终 expanded", () => {
    expect(resolveLayoutMode({ isElectron: true, isCapacitor: true })).toBe("expanded");
  });

  test("Capacitor 为 compact", () => {
    expect(resolveLayoutMode({ isCapacitor: true })).toBe("compact");
  });

  test("窄视口浏览器为 compact（与 drawer 断点一致）", () => {
    expect(resolveLayoutMode({ isNarrowViewport: true })).toBe("compact");
  });

  test("桌面宽屏默认 expanded", () => {
    expect(resolveLayoutMode({ isNarrowViewport: false })).toBe("expanded");
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
