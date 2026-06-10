import { describe, it, expect } from "bun:test";
import { ToolSetRegistry } from "@freeanima/engine-tool";
import { LIFE_ESTATE_PACKAGE, registerEstateTools } from "./index.ts";

describe("@freeanima/life-estate", () => {
  it("package is importable", () => {
    expect(LIFE_ESTATE_PACKAGE).toBe("@freeanima/life-estate");
  });

  it("registerEstateTools is callable", () => {
    expect(() => registerEstateTools(new ToolSetRegistry())).not.toThrow();
  });
});
