import { beforeEach, describe, expect, it } from "bun:test";

import { applyHostI18nConfig, getHostTimezone, resetHostI18nForTests } from "./host-messages.ts";

describe("host timezone", () => {
  beforeEach(() => {
    resetHostI18nForTests();
  });

  it("defaults to UTC and applies timezone", () => {
    expect(getHostTimezone()).toBe("UTC");
    applyHostI18nConfig({ timezone: "Asia/Shanghai" });
    expect(getHostTimezone()).toBe("Asia/Shanghai");
  });
});
