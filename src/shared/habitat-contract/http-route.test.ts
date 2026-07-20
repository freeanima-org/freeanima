import { describe, expect, test } from "bun:test";
import { z } from "zod";

import { coercePayloadForSchema } from "./http-route.ts";

describe("coercePayloadForSchema", () => {
  const schema = z.object({
    recipient_kind: z.enum(["user", "agent"]),
    recipient_id: z.string().min(1).optional(),
    read_filter: z.enum(["all", "unread"]).optional(),
    offset: z.number().int().min(0).optional(),
    limit: z.number().int().min(1).max(100).optional(),
    active: z.boolean().optional(),
  });

  test("restores numeric-looking string field to string (recipient_id)", () => {
    // query 解码把 "53" 预先转成数字 53，schema 期望 string 时须还原
    const coerced = coercePayloadForSchema(
      { recipient_kind: "user", recipient_id: 53, read_filter: "unread", offset: 0, limit: 20 },
      schema,
    );
    expect(coerced.recipient_id).toBe("53");
    expect(coerced.offset).toBe(0);
    expect(coerced.limit).toBe(20);
    expect(() => schema.parse(coerced)).not.toThrow();
  });

  test("coerces numeric string to number for number fields", () => {
    const coerced = coercePayloadForSchema({ offset: "0", limit: "20" }, schema);
    expect(coerced.offset).toBe(0);
    expect(coerced.limit).toBe(20);
  });

  test("coerces boolean string to boolean and back to string when schema wants string", () => {
    const coerced = coercePayloadForSchema({ active: "true", recipient_id: true }, schema);
    expect(coerced.active).toBe(true);
    expect(coerced.recipient_id).toBe("true");
  });
});
