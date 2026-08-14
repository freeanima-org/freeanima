import { beforeEach, describe, expect, test } from "bun:test";

import { isHabitatMethod } from "@freeanima/shared/habitat-contract";
import { resetHabitatMethodRegistryForTests } from "@freeanima/shared/habitat-contract/registry/runtime.ts";
import {
  ensureClientHabitatMethodRegistry,
  resetClientHabitatMethodRegistryForTests,
} from "./install-client-method-registry.ts";

describe("ensureClientHabitatMethodRegistry", () => {
  beforeEach(() => {
    resetHabitatMethodRegistryForTests();
    resetClientHabitatMethodRegistryForTests();
  });

  test("安装后 feature method 可被 isHabitatMethod 识别", () => {
    expect(isHabitatMethod("pomodoro.focus.list")).toBe(false);
    ensureClientHabitatMethodRegistry();
    expect(isHabitatMethod("pomodoro.focus.list")).toBe(true);
    expect(isHabitatMethod("tasklist.item.list")).toBe(true);
    expect(isHabitatMethod("conversation.list")).toBe(true);
  });
});
