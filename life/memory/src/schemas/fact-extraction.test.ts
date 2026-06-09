import { describe, expect, it } from "bun:test";
import { factExtractionSchema } from "./fact-extraction.ts";

describe("factExtractionSchema", () => {
  it("解析 facts 与 summary", () => {
    const parsed = factExtractionSchema.parse({
      facts: [{ content: "用户喜欢咖啡", type: "preference" }],
      summary: "饮食偏好",
    });
    expect(parsed.facts).toHaveLength(1);
    expect(parsed.summary).toBe("饮食偏好");
  });

  it("缺省字段使用默认空值", () => {
    const parsed = factExtractionSchema.parse({});
    expect(parsed.facts).toEqual([]);
    expect(parsed.summary).toBe("");
  });

  it("拒绝非对象 facts", () => {
    expect(() => factExtractionSchema.parse({ facts: "bad" })).toThrow();
  });
});
