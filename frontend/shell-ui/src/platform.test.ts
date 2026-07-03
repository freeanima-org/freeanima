import { describe, expect, test } from "bun:test";

import { resolveSettingsPlatform } from "../app/src/platform.ts";

describe("resolveSettingsPlatform", () => {
  test("compact layoutMode 为 mobile settings chrome", () => {
    expect(resolveSettingsPlatform({ layoutMode: "compact" })).toBe("mobile");
  });

  test("expanded layoutMode 为 desktop settings chrome", () => {
    expect(resolveSettingsPlatform({ layoutMode: "expanded" })).toBe("desktop");
  });

  test("默认 desktop", () => {
    expect(resolveSettingsPlatform({})).toBe("desktop");
  });
});
