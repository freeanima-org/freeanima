import { describe, expect, it } from "bun:test";
import { z } from "zod";

import {
  attachToolReturns,
  defineTextToolReturn,
  defineToolReturn,
  globalToolErrorContract,
} from "./return-contract.ts";

describe("defineToolReturn", () => {
  it("推导 returnSchema 并校验 example", () => {
    const contract = defineToolReturn({
      schema: z.object({ ok: z.literal(true), count: z.number() }),
      example: { ok: true, count: 3 },
    });
    expect(contract.returnKind).toBe("json");
    expect(contract.returnSchema?.type).toBe("object");
    expect(contract.returnExample).toEqual({ ok: true, count: 3 });
  });

  it("example 不匹配 schema 时抛错", () => {
    expect(() =>
      defineToolReturn({
        schema: z.object({ count: z.number() }),
        example: { count: "invalid" } as unknown as { count: number },
      }),
    ).toThrow();
  });
});

describe("defineTextToolReturn", () => {
  it("设置 text 契约", () => {
    const contract = defineTextToolReturn({
      hint: "行号|内容",
      example: "1|hello",
    });
    expect(contract.returnKind).toBe("text");
    expect(contract.returnTextHint).toBe("行号|内容");
    expect(contract.returnExample).toBe("1|hello");
  });
});

describe("attachToolReturns", () => {
  it("按名称合并契约", () => {
    const base = {
      name: "demo",
      description: "d",
      parameters: { type: "object" },
      handler: () => "{}",
    };
    const contract = defineToolReturn({
      schema: z.object({ ok: z.boolean() }),
      example: { ok: true },
    });
    const out = attachToolReturns([base], { demo: contract });
    expect(out[0]?.returnKind).toBe("json");
    expect(out[0]?.returnExample).toEqual({ ok: true });
  });
});

describe("globalToolErrorContract", () => {
  it("返回统一错误 schema 与示例", () => {
    const err = globalToolErrorContract();
    expect(err.error_example).toEqual({ error: "示例错误信息" });
    expect(err.error_schema.type).toBe("object");
  });
});
