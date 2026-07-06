import { describe, expect, it } from "bun:test";
import { z } from "zod";

import { okObjectSchema, paginatedListSchema } from "./common.ts";

describe("return-schemas common", () => {
  it("okObjectSchema requires literal true", () => {
    expect(okObjectSchema.parse({ ok: true })).toEqual({ ok: true });
    expect(() => okObjectSchema.parse({ ok: false })).toThrow();
  });

  it("paginatedListSchema wraps item schema", () => {
    const schema = paginatedListSchema(z.object({ id: z.number() }));
    expect(schema.parse({ items: [{ id: 1 }], total: 1 })).toEqual({
      items: [{ id: 1 }],
      total: 1,
    });
    expect(() => schema.parse({ items: [{ id: "x" }], total: 1 })).toThrow();
  });
});
