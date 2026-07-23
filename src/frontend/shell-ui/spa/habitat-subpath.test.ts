import { describe, expect, it } from "bun:test";

import { resolveHabitatSubpath } from "./habitat-subpath.ts";

describe("resolveHabitatSubpath", () => {
  it("maps dashboard shell path", () => {
    expect(resolveHabitatSubpath("/habitat/dashboard")).toBe("/dashboard");
  });

  it("defaults bare /habitat to dashboard", () => {
    expect(resolveHabitatSubpath("/habitat")).toBe("/dashboard");
    expect(resolveHabitatSubpath("/habitat/")).toBe("/dashboard");
  });

  it("defaults non-habitat paths to dashboard", () => {
    expect(resolveHabitatSubpath("/tasks")).toBe("/dashboard");
    expect(resolveHabitatSubpath("/chat")).toBe("/dashboard");
  });

  it("maps nested habitat routes", () => {
    expect(resolveHabitatSubpath("/habitat/mcp")).toBe("/mcp");
    expect(resolveHabitatSubpath("/web/habitat/cron")).toBe("/cron");
  });
});
