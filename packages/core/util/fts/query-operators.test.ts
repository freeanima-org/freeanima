import { describe, expect, it } from "bun:test";

import {
  buildOperatorTsQuery,
  flushOperandGroup,
  hasFtsQueryOperators,
  isFtsOperatorToken,
  operatorTokenToSymbol,
  parseFtsOperatorQuery,
  tokenizeFtsQuery,
} from "./query-operators.ts";

describe("tokenizeFtsQuery", () => {
  it("splits plain tokens and preserves quoted phrases", () => {
    expect(tokenizeFtsQuery('退烧 OR "儿童 用药"')).toEqual(["退烧", "OR", '"儿童 用药"']);
  });

  it("handles unclosed quote as single token", () => {
    expect(tokenizeFtsQuery('"未闭合')).toEqual(['"未闭合']);
  });
});

describe("operator helpers", () => {
  it("detects spaced boolean operators", () => {
    expect(hasFtsQueryOperators("退烧 OR 热情")).toBe(true);
    expect(hasFtsQueryOperators("退烧热情")).toBe(false);
  });

  it("maps operator tokens to symbols", () => {
    expect(operatorTokenToSymbol("and")).toBe("&");
    expect(operatorTokenToSymbol("OR")).toBe("|");
    expect(operatorTokenToSymbol("not")).toBe("!");
    expect(operatorTokenToSymbol("退烧")).toBeNull();
  });

  it("recognizes operator tokens case-insensitively", () => {
    expect(isFtsOperatorToken("Or")).toBe(true);
    expect(isFtsOperatorToken("退烧")).toBe(false);
  });
});

describe("parseFtsOperatorQuery", () => {
  it("segments operands and operators", () => {
    expect(parseFtsOperatorQuery("退烧 OR 热情")).toEqual([
      { type: "operands", tokens: ["退烧"] },
      { type: "op", op: "|" },
      { type: "operands", tokens: ["热情"] },
    ]);
  });
});

describe("flushOperandGroup", () => {
  it("joins multiple operands with AND", () => {
    expect(flushOperandGroup(["a", "b"])).toBe("a & b");
  });

  it("returns single operand unchanged", () => {
    expect(flushOperandGroup(["only"])).toBe("only");
  });

  it("filters empty strings", () => {
    expect(flushOperandGroup(["", "x", ""])).toBe("x");
    expect(flushOperandGroup([])).toBe("");
  });
});

describe("buildOperatorTsQuery", () => {
  it("builds tsquery with wrapped compound operands", () => {
    const segments = parseFtsOperatorQuery("退烧 OR 热情 AND 咳嗽");
    const out = buildOperatorTsQuery(segments, (tok) => tok);
    expect(out).toContain("|");
    expect(out).toContain("&");
  });

  it("wraps operands containing inner operators", () => {
    const segments: ReturnType<typeof parseFtsOperatorQuery> = [
      { type: "operands", tokens: ["a & b"] },
    ];
    expect(buildOperatorTsQuery(segments, (tok) => tok)).toBe("(a & b)");
  });
});
