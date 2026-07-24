import { describe, expect, it } from "bun:test";
import { hasComponent, mergeAttributes } from "./merge-attributes.ts";

describe("mergeAttributes", () => {
  it("returns empty object with no args", () => {
    expect(mergeAttributes()).toEqual({});
  });

  it("skips undefined parts", () => {
    expect(mergeAttributes({ a: 1 }, undefined, { b: 2 })).toEqual({ a: 1, b: 2 });
  });

  it("shallow merge; later overwrites same key", () => {
    expect(mergeAttributes({ a: 1, nested: { x: 1 } }, { a: 2, b: 3 })).toEqual({
      a: 2,
      nested: { x: 1 },
      b: 3,
    });
  });

  it("does not deep-merge nested objects", () => {
    expect(mergeAttributes({ meta: { a: 1 } }, { meta: { b: 2 } })).toEqual({
      meta: { b: 2 },
    });
  });
});

describe("hasComponent", () => {
  it("non-empty string component is true", () => {
    expect(hasComponent({ component: "kernel" })).toBe(true);
  });

  it("empty string, missing, or non-string is false", () => {
    expect(hasComponent({ component: "" })).toBe(false);
    expect(hasComponent({})).toBe(false);
    expect(hasComponent({ component: 42 })).toBe(false);
    expect(hasComponent({ component: null })).toBe(false);
  });
});
