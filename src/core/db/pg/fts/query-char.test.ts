import { describe, expect, it } from "bun:test";

import {
  buildCharModeTsQuery,
  buildJiebaGroupTsQuery,
  buildJiebaModeTsQuery,
  CJK_PROXIMITY_MAX_CHARS,
} from "./query-char.ts";

describe("buildCharModeTsQuery", () => {
  it("joins multi-word AND groups inside OR expressions with &", () => {
    const tsq = buildCharModeTsQuery("退烧 OR 注意力 OR 方向 摇摆 OR 热情");
    expect(tsq).toBe(
      "(退 <-> 烧) | ((注 <-> 意) | (意 <-> 力)) | (方 <-> 向) & (摇 <-> 摆) | (热 <-> 情)",
    );
    expect(tsq).not.toMatch(/\)\s+\(/);
  });

  it("builds simple OR chains without bare spaces", () => {
    const tsq = buildCharModeTsQuery("退烧 OR 注意力 OR 热情");
    expect(tsq).toBe("(退 <-> 烧) | ((注 <-> 意) | (意 <-> 力)) | (热 <-> 情)");
    expect(tsq).not.toMatch(/\)\s+\(/);
  });

  it("defaults space-separated terms to OR", () => {
    expect(buildCharModeTsQuery("方向 摇摆")).toBe("(方 <-> 向) | (摇 <-> 摆)");
  });

  it("preserves left-to-right operator sequence", () => {
    expect(buildCharModeTsQuery("A OR B AND C")).toBe("A | B & C");
  });

  it("supports quoted phrase operands in OR queries", () => {
    expect(buildCharModeTsQuery('"注意力" OR test')).toBe("(注 <-> 意 <-> 力) | test");
  });

  it("uses full proximity for 1–2 CJK chars", () => {
    expect(buildCharModeTsQuery("邮箱")).toBe("邮 <-> 箱");
  });

  it("uses bigram OR for longer unquoted CJK (NL questions)", () => {
    const tsq = buildCharModeTsQuery("你的邮箱是啥？");
    expect(tsq).toContain("(邮 <-> 箱)");
    expect(tsq).toContain(" | ");
    expect(tsq).not.toContain("？");
    // Must not require the whole question as one proximity span
    expect(tsq).not.toMatch(/你 <-> 的 <-> 邮 <-> 箱 <-> 是 <-> 啥/);
  });

  it("uses bigram OR when length exceeds CJK_PROXIMITY_MAX_CHARS", () => {
    const long = "甲".repeat(CJK_PROXIMITY_MAX_CHARS + 1);
    const tsq = buildCharModeTsQuery(long);
    expect(tsq).toContain(" | ");
    expect(tsq).not.toMatch(/^(?:甲 <-> )+甲$/);
    expect(tsq.startsWith("(甲 <-> 甲)")).toBe(true);
  });

  it("keeps full proximity for long quoted CJK phrases", () => {
    const long = "甲".repeat(CJK_PROXIMITY_MAX_CHARS + 1);
    const tsq = buildCharModeTsQuery(`"${long}"`);
    expect(tsq).not.toContain(" | ");
    expect(tsq.includes("<->")).toBe(true);
  });
});

describe("buildJiebaModeTsQuery", () => {
  it("joins segmented tokens with OR", () => {
    expect(buildJiebaModeTsQuery("方向 摇摆")).toBe("方向 | 摇摆");
  });
});

describe("buildJiebaGroupTsQuery", () => {
  it("joins operand-group tokens with AND", () => {
    expect(buildJiebaGroupTsQuery("方向 摇摆")).toBe("(方向 & 摇摆)");
  });
});
