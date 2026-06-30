import { describe, expect, it } from "vitest";

import { resolveEmbeddedAdminBasepath, shellBasepathFromViteBase } from "./router-basepath.ts";

describe("shellBasepathFromViteBase", () => {
  it("returns undefined for root or relative base", () => {
    expect(shellBasepathFromViteBase("/")).toBeUndefined();
    expect(shellBasepathFromViteBase("./")).toBeUndefined();
  });

  it("normalizes Hub web base", () => {
    expect(shellBasepathFromViteBase("/web/")).toBe("/web");
  });
});

describe("resolveEmbeddedAdminBasepath", () => {
  it("uses /admin when shell has no basepath", () => {
    expect(resolveEmbeddedAdminBasepath()).toBe("/admin");
  });
});
