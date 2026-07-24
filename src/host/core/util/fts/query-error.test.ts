import { describe, expect, it } from "bun:test";

import { formatFtsToolError, FtsQueryError, isFtsQueryError } from "./query-error.ts";

describe("FtsQueryError", () => {
  it("carries code and hint", () => {
    const err = new FtsQueryError("empty_query", "查询为空", "请输入关键词");
    expect(err.name).toBe("FtsQueryError");
    expect(err.code).toBe("empty_query");
    expect(err.hint).toBe("请输入关键词");
  });

  it("isFtsQueryError narrows type", () => {
    const err = new FtsQueryError("unclosed_quote", "引号未闭合", "补全引号");
    expect(isFtsQueryError(err)).toBe(true);
    expect(isFtsQueryError(new Error("x"))).toBe(false);
  });

  it("formatFtsToolError includes hint", () => {
    const err = new FtsQueryError("trailing_operator", "尾部运算符", "去掉尾部 OR");
    expect(formatFtsToolError(err)).toBe("尾部运算符\n修改建议：去掉尾部 OR");
  });
});
