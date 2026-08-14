import { afterEach, describe, expect, it } from "bun:test";

import { COMPACT_LAYOUT_MQ, isCompactLayoutViewport } from "./viewport.ts";

const hasWindow = typeof globalThis.window !== "undefined";

describe("layout viewport", () => {
  if (!hasWindow) {
    it.skip("需要 DOM 环境", () => {});
    return;
  }

  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it("COMPACT_LAYOUT_MQ matches task/chat breakpoint", () => {
    expect(COMPACT_LAYOUT_MQ).toBe("(max-width: 767px)");
  });

  it("isCompactLayoutViewport uses matchMedia", () => {
    window.matchMedia = (query: string) =>
      ({
        matches: query.includes("767px"),
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) satisfies MediaQueryList;
    expect(isCompactLayoutViewport()).toBe(true);
  });
});
