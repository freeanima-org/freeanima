import { describe, expect, it } from "bun:test";

import { resolveEmbeddedConsoleBasepath, shellBasepathFromViteBase } from "./router-basepath.ts";

describe("shellBasepathFromViteBase", () => {
  it("returns undefined for root or relative base", () => {
    expect(shellBasepathFromViteBase("/")).toBeUndefined();
    expect(shellBasepathFromViteBase("./")).toBeUndefined();
  });

  it("normalizes Hub web base", () => {
    expect(shellBasepathFromViteBase("/web/")).toBe("/web");
  });
});

describe("resolveEmbeddedConsoleBasepath", () => {
  it("uses /console when shell has no basepath", () => {
    expect(resolveEmbeddedConsoleBasepath()).toBe("/console");
  });
});
