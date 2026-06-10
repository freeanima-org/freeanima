import { describe, it, expect } from "bun:test";
import { LIFE_SELF_PACKAGE } from "./index.ts";

describe("@freeanima/life-self", () => {
  it("package is importable", () => {
    expect(LIFE_SELF_PACKAGE).toBe("@freeanima/life-self");
  });
});
