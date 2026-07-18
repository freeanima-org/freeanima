import { describe, expect, it } from "bun:test";

import { consoleSubpathToShellPath, resolveConsoleSubpath } from "./console-path.ts";

describe("resolveConsoleSubpath", () => {
  it("maps dashboard shell path", () => {
    expect(resolveConsoleSubpath("/web/console/dashboard")).toBe("/dashboard");
    expect(resolveConsoleSubpath("/console/dashboard")).toBe("/dashboard");
  });

  it("defaults bare /console to dashboard", () => {
    expect(resolveConsoleSubpath("/console")).toBe("/dashboard");
    expect(resolveConsoleSubpath("/console/")).toBe("/dashboard");
  });
});

describe("consoleSubpathToShellPath", () => {
  it("maps inner routes under /console", () => {
    expect(consoleSubpathToShellPath("/dashboard")).toBe("/console/dashboard");
    expect(consoleSubpathToShellPath("/mcp")).toBe("/console/mcp");
    expect(consoleSubpathToShellPath("/")).toBe("/console/dashboard");
  });
});
