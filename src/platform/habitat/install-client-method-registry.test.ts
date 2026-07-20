import { beforeEach, describe, expect, test } from "bun:test";

import { isHubMethod } from "@freeanima/shared/habitat-contract";
import { resetHubMethodRegistryForTests } from "@freeanima/shared/habitat-contract/registry/runtime.ts";
import {
  ensureClientHubMethodRegistry,
  resetClientHubMethodRegistryForTests,
} from "./install-client-method-registry.ts";

describe("ensureClientHubMethodRegistry", () => {
  beforeEach(() => {
    resetHubMethodRegistryForTests();
    resetClientHubMethodRegistryForTests();
  });

  test("安装后 feature method 可被 isHubMethod 识别", () => {
    expect(isHubMethod("pomodoro.focus.list")).toBe(false);
    ensureClientHubMethodRegistry();
    expect(isHubMethod("pomodoro.focus.list")).toBe(true);
    expect(isHubMethod("tasklist.item.list")).toBe(true);
    expect(isHubMethod("conversation.list")).toBe(true);
  });
});
