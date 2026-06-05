import { describe, it, expect } from "bun:test";
import { LIFE_ESTATE_PACKAGE } from "../../src/index.ts";

describe("@freeanima/life-estate", () => {
  it("包可 import", () => {
    expect(LIFE_ESTATE_PACKAGE).toBe("@freeanima/life-estate");
  });
});
