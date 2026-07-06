import { afterEach, describe, expect, it } from "bun:test";

import {
  readShellRailExpanded,
  resetShellRailExpandedForTest,
  writeShellRailExpanded,
} from "./shell-rail-prefs.ts";

describe("shell-rail-prefs", () => {
  afterEach(() => {
    resetShellRailExpandedForTest();
  });

  it("默认收起", () => {
    expect(readShellRailExpanded()).toBe(false);
  });

  it("持久化展开状态", () => {
    writeShellRailExpanded(true);
    expect(readShellRailExpanded()).toBe(true);
    writeShellRailExpanded(false);
    expect(readShellRailExpanded()).toBe(false);
  });
});
