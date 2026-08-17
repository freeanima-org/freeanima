import { beforeEach, describe, expect, it } from "bun:test";

import { applyHostI18nConfig, getHostTimezone, resetHostI18nForTests } from "./host-messages.ts";
import { formatCstIso, getConfiguredHostTimeZone } from "@freeanima/shared/util/time.ts";

describe("host timezone", () => {
  beforeEach(() => {
    resetHostI18nForTests();
  });

  it("defaults to Asia/Shanghai and applies timezone", () => {
    expect(getHostTimezone()).toBe("Asia/Shanghai");
    applyHostI18nConfig({ timezone: "UTC" });
    expect(getHostTimezone()).toBe("UTC");
    expect(getConfiguredHostTimeZone()).toBe("UTC");
  });

  it("formatCstIso follows configured timezone offset", () => {
    applyHostI18nConfig({ timezone: "Asia/Shanghai" });
    const iso = formatCstIso(new Date("2024-01-01T00:00:00.000Z"));
    expect(iso.endsWith("+08:00")).toBe(true);
  });
});
