import { describe, expect, it } from "bun:test";
import { z } from "zod";

import { openaiFunctionSchema } from "./registry.ts";
import {
  attachToolReturns,
  defineTextToolReturn,
  defineToolReturn,
  globalToolErrorContract,
} from "./return-contract.ts";

describe("defineToolReturn", () => {
  it("derives returnSchema and validates example", () => {
    const contract = defineToolReturn({
      schema: z.object({ ok: z.literal(true), count: z.number() }),
      example: { ok: true, count: 3 },
    });
    expect(contract.returnKind).toBe("json");
    expect(contract.returnSchema?.type).toBe("object");
    expect(contract.returnExample).toEqual({ ok: true, count: 3 });
  });

  it("throws when example does not match schema", () => {
    expect(() =>
      defineToolReturn({
        schema: z.object({ count: z.number() }),
        example: { count: "invalid" } as unknown as { count: number },
      }),
    ).toThrow();
  });
});

describe("defineTextToolReturn", () => {
  it("sets text contract", () => {
    const contract = defineTextToolReturn({
      hint: "line|content",
      example: "1|hello",
    });
    expect(contract.returnKind).toBe("text");
    expect(contract.returnTextHint).toBe("line|content");
    expect(contract.returnExample).toBe("1|hello");
  });
});

describe("attachToolReturns", () => {
  it("merges contracts by name", () => {
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
  it("returns unified error schema and example", () => {
    const err = globalToolErrorContract();
    expect(err.error_example).toEqual({ error: "Example error message" });
    expect(err.error_schema.type).toBe("object");
  });
});

describe("openaiFunctionSchema", () => {
  it("appends return schema into description when ToolDef has returnSchema", () => {
    const contract = defineToolReturn({
      schema: z.object({ ok: z.boolean() }),
      example: { ok: true },
    });
    const entry = openaiFunctionSchema({
      name: "demo",
      description: "d",
      parameters: { type: "object", properties: {} },
      handler: () => "{}",
      ...contract,
    });
    expect(entry.function).not.toHaveProperty("return_schema");
    expect(entry.function.description).toContain("d");
    expect(entry.function.description).toContain("Returns (JSON Schema):");
    expect(entry.function.description).toContain(JSON.stringify(contract.returnSchema));
    expect(entry.function.name).toBe("demo");
  });

  it("leaves description unchanged when ToolDef has no returnSchema", () => {
    const entry = openaiFunctionSchema({
      name: "demo",
      description: "d",
      parameters: { type: "object", properties: {} },
      handler: () => "{}",
    });
    expect(entry.function.description).toBe("d");
    expect(entry.function).not.toHaveProperty("return_schema");
  });
});
