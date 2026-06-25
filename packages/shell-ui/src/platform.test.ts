import { describe, expect, test } from "bun:test";

import { resolveSettingsPlatform } from "../app/src/platform.ts";

describe("resolveSettingsPlatform", () => {
  test("isElectron 优先为 desktop", () => {
    expect(resolveSettingsPlatform({ isElectron: true, isNativeShell: true })).toBe("desktop");
  });

  test("isNativeShell 为 mobile", () => {
    expect(resolveSettingsPlatform({ isNativeShell: true })).toBe("mobile");
  });

  test("默认 desktop", () => {
    expect(resolveSettingsPlatform({})).toBe("desktop");
  });
});
