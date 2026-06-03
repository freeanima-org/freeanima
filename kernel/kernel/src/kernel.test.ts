import { describe, expect, it } from "bun:test";
import { HookRegistry } from "@freeanima/hooks";
import { Kernel } from "./index";

describe("Kernel", () => {
  it("组合 hooks 端口", () => {
    const hookRegistry = new HookRegistry();
    const kernel = new Kernel(hookRegistry);
    expect(kernel.hookRegistry).toBe(hookRegistry);
  });
});
