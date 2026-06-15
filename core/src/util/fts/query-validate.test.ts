import { describe, expect, it } from "bun:test";

import { FtsQueryError } from "./query-error.ts";
import { assertValidTsQueryString, validateFtsQueryInput } from "./query-validate.ts";

describe("validateFtsQueryInput", () => {
  it("rejects trailing operator", () => {
    expect(() => validateFtsQueryInput("退烧 OR")).toThrow(FtsQueryError);
    try {
      validateFtsQueryInput("退烧 OR");
    } catch (e) {
      expect(e).toBeInstanceOf(FtsQueryError);
      const err = e as FtsQueryError;
      expect(err.code).toBe("trailing_operator");
      expect(err.hint).toContain("退烧 OR 注意力");
    }
  });

  it("rejects leading OR/AND", () => {
    expect(() => validateFtsQueryInput("OR 退烧")).toThrow(FtsQueryError);
    expect(() => validateFtsQueryInput("AND 退烧")).toThrow(FtsQueryError);
  });

  it("rejects consecutive operators", () => {
    expect(() => validateFtsQueryInput("退烧 OR OR 热情")).toThrow(FtsQueryError);
  });

  it("rejects unclosed quotes", () => {
    expect(() => validateFtsQueryInput('"未闭合 OR test')).toThrow(FtsQueryError);
  });

  it("rejects lowercase boolean operators", () => {
    expect(() => validateFtsQueryInput("退烧 or 热情")).toThrow(FtsQueryError);
  });

  it("allows NOT at the beginning", () => {
    expect(() => validateFtsQueryInput("NOT fever")).not.toThrow();
  });
});

describe("assertValidTsQueryString", () => {
  it("rejects bare spaces between parenthesized groups", () => {
    expect(() => assertValidTsQueryString("(方 <-> 向) (摇 <-> 摆)")).toThrow(FtsQueryError);
  });

  it("accepts properly joined tsquery", () => {
    expect(() => assertValidTsQueryString("(退 <-> 烧) | (方 <-> 向) & (摇 <-> 摆)")).not.toThrow();
  });
});
