import { describe, expect, it } from "bun:test";

import { buildCharModeTsQuery, buildJiebaModeTsQuery } from "./query-char.ts";

describe("buildCharModeTsQuery", () => {
  it("joins multi-word AND groups inside OR expressions with &", () => {
    const tsq = buildCharModeTsQuery("退烧 OR 注意力 OR 方向 摇摆 OR 热情");
    expect(tsq).toBe("(退 <-> 烧) | (注 <-> 意 <-> 力) | (方 <-> 向) & (摇 <-> 摆) | (热 <-> 情)");
    expect(tsq).not.toMatch(/\)\s+\(/);
  });

  it("builds simple OR chains without bare spaces", () => {
    const tsq = buildCharModeTsQuery("退烧 OR 注意力 OR 热情");
    expect(tsq).toBe("(退 <-> 烧) | (注 <-> 意 <-> 力) | (热 <-> 情)");
    expect(tsq).not.toMatch(/\)\s+\(/);
  });

  it("defaults space-separated terms to AND", () => {
    expect(buildCharModeTsQuery("方向 摇摆")).toBe("(方 <-> 向) & (摇 <-> 摆)");
  });

  it("preserves left-to-right operator sequence", () => {
    expect(buildCharModeTsQuery("A OR B AND C")).toBe("A | B & C");
  });

  it("supports quoted phrase operands in OR queries", () => {
    expect(buildCharModeTsQuery('"注意力" OR test')).toBe("(注 <-> 意 <-> 力) | test");
  });
});

describe("buildJiebaModeTsQuery", () => {
  it("joins segmented tokens with AND", () => {
    expect(buildJiebaModeTsQuery("方向 摇摆")).toBe("方向 & 摇摆");
  });
});
