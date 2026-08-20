import { describe, expect, test } from "bun:test";
import { z } from "zod";

import { coercePayloadForSchema } from "./http-route.ts";

describe("coercePayloadForSchema", () => {
  const schema = z.object({
    recipient_kind: z.enum(["user", "agent"]),
    recipient_id: z.number().int().positive().optional(),
    read_filter: z.enum(["all", "unread"]).optional(),
    offset: z.number().int().min(0).optional(),
    limit: z.number().int().min(1).max(100).optional(),
    active: z.boolean().optional(),
  });

  test("keeps number recipient_id for number schema", () => {
    const coerced = coercePayloadForSchema(
      { recipient_kind: "user", recipient_id: 53, read_filter: "unread", offset: 0, limit: 20 },
      schema,
    );
    expect(coerced.recipient_id).toBe(53);
    expect(coerced.offset).toBe(0);
    expect(coerced.limit).toBe(20);
    expect(() => schema.parse(coerced)).not.toThrow();
  });

  test("coerces numeric string to number for number fields", () => {
    const coerced = coercePayloadForSchema(
      { offset: "0", limit: "20", recipient_id: "53" },
      schema,
    );
    expect(coerced.offset).toBe(0);
    expect(coerced.limit).toBe(20);
    expect(coerced.recipient_id).toBe(53);
  });

  test("coerces boolean string to boolean", () => {
    const coerced = coercePayloadForSchema({ active: "true" }, schema);
    expect(coerced.active).toBe(true);
  });

  test("wraps singleton query value into array when schema expects array", () => {
    const arraySchema = z.object({
      kinds: z.array(z.enum(["event", "task", "project", "holiday"])).optional(),
      sources: z
        .array(z.enum(["cn_holiday", "traditional", "international", "solar_term"]))
        .optional(),
    });
    const coerced = coercePayloadForSchema(
      { kinds: ["event", "holiday"], sources: "solar_term" },
      arraySchema,
    );
    expect(coerced.kinds).toEqual(["event", "holiday"]);
    expect(coerced.sources).toEqual(["solar_term"]);
    expect(() => arraySchema.parse(coerced)).not.toThrow();
  });

  test("parses JSON array string then keeps array", () => {
    const arraySchema = z.object({
      sources: z.array(z.string()).optional(),
    });
    const coerced = coercePayloadForSchema({ sources: '["solar_term","cn_holiday"]' }, arraySchema);
    expect(coerced.sources).toEqual(["solar_term", "cn_holiday"]);
  });
});
