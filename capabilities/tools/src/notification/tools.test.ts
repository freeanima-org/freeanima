import { describe, expect, it } from "bun:test";

import { resolveMarkReadIds } from "./tools.ts";

describe("resolveMarkReadIds", () => {
  it("returns single id", () => {
    expect(resolveMarkReadIds({ id: "a" })).toEqual(["a"]);
  });

  it("merges id and ids with dedupe", () => {
    expect(resolveMarkReadIds({ id: "a", ids: ["a", "b", " b "] })).toEqual(["a", "b"]);
  });

  it("returns null when empty", () => {
    expect(resolveMarkReadIds({})).toBeNull();
    expect(resolveMarkReadIds({ ids: [] })).toBeNull();
  });

  it("caps at 20 ids", () => {
    const ids = Array.from({ length: 25 }, (_, i) => `id-${i}`);
    expect(resolveMarkReadIds({ ids })?.length).toBe(20);
  });
});
