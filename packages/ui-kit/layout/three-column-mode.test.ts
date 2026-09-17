import { afterEach, describe, expect, test } from "bun:test";

import { readThreeColumnLayoutMode, type ThreeColumnLayoutMode } from "./three-column-mode.ts";

describe("ThreeColumnLayoutMode", () => {
  test("三档：compact / medium / wide", () => {
    const modes: ThreeColumnLayoutMode[] = ["compact", "medium", "wide"];
    expect(modes).toHaveLength(3);
  });
});

describe("readThreeColumnLayoutMode", () => {
  const originalMatchMedia = globalThis.window?.matchMedia;

  afterEach(() => {
    if (originalMatchMedia && globalThis.window) {
      globalThis.window.matchMedia = originalMatchMedia;
    }
  });

  function mockMatchMedia(mobile: boolean, wide: boolean) {
    if (!globalThis.window) return;
    globalThis.window.matchMedia = (query: string) => {
      const matches =
        query.includes("767px") && query.includes("max-width")
          ? mobile
          : query.includes("1028px")
            ? wide
            : false;
      return {
        matches,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      } satisfies MediaQueryList;
    };
  }

  test("窄视口 compact", () => {
    if (!globalThis.window) return;
    mockMatchMedia(true, false);
    expect(readThreeColumnLayoutMode()).toBe("compact");
  });

  test("中宽桌面 medium", () => {
    if (!globalThis.window) return;
    mockMatchMedia(false, false);
    expect(readThreeColumnLayoutMode()).toBe("medium");
  });

  test("宽屏 wide", () => {
    if (!globalThis.window) return;
    mockMatchMedia(false, true);
    expect(readThreeColumnLayoutMode()).toBe("wide");
  });
});
