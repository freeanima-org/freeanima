import { describe, expect, it } from "bun:test";

import { habitatSubpathToShellPath, resolveHabitatSubpath } from "./habitat-path.ts";

describe("resolveHabitatSubpath", () => {
  it("maps dashboard shell path", () => {
    expect(resolveHabitatSubpath("/web/habitat/dashboard")).toBe("/dashboard");
    expect(resolveHabitatSubpath("/habitat/dashboard")).toBe("/dashboard");
  });

  it("defaults bare /habitat to dashboard", () => {
    expect(resolveHabitatSubpath("/habitat")).toBe("/dashboard");
    expect(resolveHabitatSubpath("/habitat/")).toBe("/dashboard");
  });
});

describe("habitatSubpathToShellPath", () => {
  it("maps inner routes under /habitat", () => {
    expect(habitatSubpathToShellPath("/dashboard")).toBe("/habitat/dashboard");
    expect(habitatSubpathToShellPath("/mcp")).toBe("/habitat/mcp");
    expect(habitatSubpathToShellPath("/")).toBe("/habitat/dashboard");
  });
});
