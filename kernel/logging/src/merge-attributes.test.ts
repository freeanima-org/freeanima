import { describe, expect, it } from "bun:test";
import { hasComponent, mergeAttributes } from "./merge-attributes.js";

describe("mergeAttributes", () => {
  it("无参数时返回空对象", () => {
    expect(mergeAttributes()).toEqual({});
  });

  it("跳过 undefined 部分", () => {
    expect(mergeAttributes({ a: 1 }, undefined, { b: 2 })).toEqual({ a: 1, b: 2 });
  });

  it("浅合并，后者覆盖同键", () => {
    expect(mergeAttributes({ a: 1, nested: { x: 1 } }, { a: 2, b: 3 })).toEqual({
      a: 2,
      nested: { x: 1 },
      b: 3,
    });
  });

  it("不深度合并嵌套对象", () => {
    expect(mergeAttributes({ meta: { a: 1 } }, { meta: { b: 2 } })).toEqual({
      meta: { b: 2 },
    });
  });
});

describe("hasComponent", () => {
  it("非空字符串 component 为 true", () => {
    expect(hasComponent({ component: "kernel" })).toBe(true);
  });

  it("空字符串、缺失或非 string 为 false", () => {
    expect(hasComponent({ component: "" })).toBe(false);
    expect(hasComponent({})).toBe(false);
    expect(hasComponent({ component: 42 })).toBe(false);
    expect(hasComponent({ component: null })).toBe(false);
  });
});
