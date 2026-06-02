import { describe, expect, it } from "vitest";
import { HookRegistry } from "@freeanima/hooks";
import { kernel } from "../../src/kernel.js";

describe("legacy-engine kernel", () => {
  it("kernel.hookRegistry 为 HookRegistry 实例", () => {
    expect(kernel.hookRegistry).toBeInstanceOf(HookRegistry);
  });
});
