import { describe, expect, test } from "bun:test";

import {
  applyHostI18nConfig,
  getHostLocale,
  getHostTimezone,
  hostMsg,
  resetHostI18nForTests,
} from "./host-messages.ts";

describe("host i18n", () => {
  test("defaults and apply config", () => {
    resetHostI18nForTests();
    expect(getHostLocale()).toBe("en");
    expect(getHostTimezone()).toBe("UTC");
    applyHostI18nConfig({ locale: "zh-cn", timezone: "Asia/Shanghai" });
    expect(getHostLocale()).toBe("zh-cn");
    expect(getHostTimezone()).toBe("Asia/Shanghai");
    expect(hostMsg("error_unauthorized")).toBe("未授权");
  });

  test("falls back to english key catalog", () => {
    resetHostI18nForTests();
    expect(hostMsg("error_not_found")).toBe("Not found");
  });
});
