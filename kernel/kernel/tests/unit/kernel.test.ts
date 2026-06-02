import { describe, expect, it } from "vitest";
import { HookRegistry } from "@freeanima/hooks";
import { Kernel } from "../../src/index.js";

describe("Kernel", () => {
  it("组合 hooks 端口", () => {
    // const kernel = new Kernel(HookRegistry());
    const hookRegistry = new HookRegistry();
    const kernel = new Kernel(hookRegistry);
    expect(kernel.hookRegistry).toBe(hookRegistry);
  });
});
