import { afterEach, describe, expect, it } from "bun:test";

import {
  readAppRailExpanded,
  resetShellRailExpandedForTest,
  writeAppRailExpanded,
} from "./app-rail-prefs.ts";

describe("app-rail-prefs", () => {
  afterEach(() => {
    resetShellRailExpandedForTest();
  });

  it("默认收起", () => {
    expect(readAppRailExpanded()).toBe(false);
  });

  it("持久化展开状态", () => {
    writeAppRailExpanded(true);
    expect(readAppRailExpanded()).toBe(true);
    writeAppRailExpanded(false);
    expect(readAppRailExpanded()).toBe(false);
  });
});
