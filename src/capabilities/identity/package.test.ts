import { describe, it, expect } from "bun:test";
import { CAPABILITIES_IDENTITY_PACKAGE } from "./index.ts";

describe("@freeanima/capabilities-identity", () => {
  it("package is importable", () => {
    expect(CAPABILITIES_IDENTITY_PACKAGE).toBe("@freeanima/capabilities-identity");
  });
});
