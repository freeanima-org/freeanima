import { describe, expect, it } from "bun:test";

import { resolveConsoleSubpath } from "./console-subpath.ts";

describe("resolveConsoleSubpath", () => {
  it("maps dashboard shell path", () => {
    expect(resolveConsoleSubpath("/console/dashboard")).toBe("/dashboard");
  });

  it("defaults bare /console to dashboard", () => {
    expect(resolveConsoleSubpath("/console")).toBe("/dashboard");
    expect(resolveConsoleSubpath("/console/")).toBe("/dashboard");
  });

  it("defaults non-console paths to dashboard", () => {
    expect(resolveConsoleSubpath("/tasks")).toBe("/dashboard");
    expect(resolveConsoleSubpath("/chat")).toBe("/dashboard");
  });
});
