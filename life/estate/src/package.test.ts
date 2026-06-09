import { describe, it, expect } from "bun:test";
import { ToolRegistry } from "@freeanima/engine-tool";
import { LIFE_ESTATE_PACKAGE, registerEstateTools } from "./index.ts";

describe("@freeanima/life-estate", () => {
  it("包可 import", () => {
    expect(LIFE_ESTATE_PACKAGE).toBe("@freeanima/life-estate");
  });

  it("registerEstateTools 可调用", () => {
    expect(() => registerEstateTools(new ToolRegistry())).not.toThrow();
  });
});
