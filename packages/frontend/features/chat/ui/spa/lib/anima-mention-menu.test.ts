import { describe, expect, it } from "bun:test";

import {
  applyAnimaMentionInsert,
  buildAnimaMentionInsert,
  parseAnimaMentionTrigger,
} from "./anima-mention-menu.ts";

describe("parseAnimaMentionTrigger", () => {
  it("detects bare [[", () => {
    expect(parseAnimaMentionTrigger("hello [[", 8)).toEqual({ start: 6, query: "" });
  });

  it("captures query after [[", () => {
    expect(parseAnimaMentionTrigger("见 [[OKR", 7)).toEqual({ start: 2, query: "OKR" });
  });

  it("ignores closed markers", () => {
    expect(parseAnimaMentionTrigger("[[anima:1]] x", 13)).toBeNull();
  });

  it("uses last open [[ before cursor", () => {
    expect(parseAnimaMentionTrigger("[[a]] [[b", 9)).toEqual({ start: 6, query: "b" });
  });
});

describe("applyAnimaMentionInsert", () => {
  it("replaces from [[ to cursor", () => {
    const r = applyAnimaMentionInsert("见 [[OKR", 2, 7, buildAnimaMentionInsert(1339));
    expect(r.next).toBe("见 [[anima:1339]] ");
    expect(r.caret).toBe("见 [[anima:1339]] ".length);
  });
});
