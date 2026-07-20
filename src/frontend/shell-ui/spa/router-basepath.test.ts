import { describe, expect, it } from "bun:test";

import { resolveEmbeddedHabitatBasepath, shellBasepathFromViteBase } from "./router-basepath.ts";

describe("shellBasepathFromViteBase", () => {
  it("returns undefined for root or relative base", () => {
    expect(shellBasepathFromViteBase("/")).toBeUndefined();
    expect(shellBasepathFromViteBase("./")).toBeUndefined();
  });

  it("normalizes Habitat web base", () => {
    expect(shellBasepathFromViteBase("/web/")).toBe("/web");
  });
});

describe("resolveEmbeddedHabitatBasepath", () => {
  it("uses /habitat when shell has no basepath", () => {
    expect(resolveEmbeddedHabitatBasepath()).toBe("/habitat");
  });
});
