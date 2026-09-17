import { describe, expect, it } from "bun:test";

import { tsqueryAfterCjkSegment } from "./query.ts";

describe("tsqueryAfterCjkSegment", () => {
  it("falls back to char-mode bigram OR when jieba not loaded", () => {
    const tsq = tsqueryAfterCjkSegment("风油精是什么", "风油精是什么", false);
    expect(tsq).toContain(" | ");
    expect(tsq).toContain("<->");
    expect(tsq).not.toBe("风油精是什么");
  });

  it("uses jieba OR tokens when jieba loaded", () => {
    expect(tsqueryAfterCjkSegment("风油精是什么", "风油精 是 什么", true)).toBe(
      "风油精 | 是 | 什么",
    );
  });
});
