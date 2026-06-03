import { describe, expect, it } from "bun:test";
import { HookRegistry } from "@freeanima/hooks";
import { kernel } from "../../src/kernel";

describe("legacy-engine kernel", () => {
  it("kernel.hookRegistry 为 HookRegistry 实例", () => {
    expect(kernel.hookRegistry).toBeInstanceOf(HookRegistry);
  });
});
