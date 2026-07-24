import { describe, expect, test } from "bun:test";

import { parseLayoutModeOverride, resolveLayoutMode } from "../spa/layout-mode.ts";

describe("resolveLayoutMode", () => {
  test("窄视口为 compact（移动布局）", () => {
    expect(resolveLayoutMode({ isNarrowViewport: true })).toBe("compact");
  });

  test("中宽视口默认 expanded（桌面布局）", () => {
    expect(resolveLayoutMode({ isNarrowViewport: false })).toBe("expanded");
  });

  test("桌面窄窗仍随视口为 compact", () => {
    expect(resolveLayoutMode({ isNarrowViewport: true })).toBe("compact");
  });

  test("移动宽屏随视口为 expanded", () => {
    expect(resolveLayoutMode({ isNarrowViewport: false })).toBe("expanded");
  });

  test("configLayoutMode 覆盖视口", () => {
    expect(resolveLayoutMode({ configLayoutMode: "expanded", isNarrowViewport: true })).toBe(
      "expanded",
    );
  });

  test("URL layout 覆盖优先", () => {
    expect(resolveLayoutMode({ layoutOverride: "expanded", isNarrowViewport: true })).toBe(
      "expanded",
    );
    expect(resolveLayoutMode({ layoutOverride: "compact", isNarrowViewport: false })).toBe(
      "compact",
    );
  });
});

describe("parseLayoutModeOverride", () => {
  test("解析别名", () => {
    expect(parseLayoutModeOverride("mobile")).toBe("compact");
    expect(parseLayoutModeOverride("desktop")).toBe("expanded");
  });
});
