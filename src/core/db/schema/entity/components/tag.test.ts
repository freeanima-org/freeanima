import { describe, expect, test } from "bun:test";

import { TAG_COMPONENT, tagBodySchema } from "./tag.ts";

describe("tag component", () => {
  test("TAG_COMPONENT id", () => {
    expect(TAG_COMPONENT).toBe("tag");
  });

  test("tagBodySchema defaults", () => {
    const parsed = tagBodySchema.parse({});
    expect(parsed.client_op_id).toBeNull();
    expect(parsed.sort_order).toBeUndefined();
  });

  test("tagBodySchema accepts sort_order", () => {
    const parsed = tagBodySchema.parse({ sort_order: 2, client_op_id: "c1" });
    expect(parsed.sort_order).toBe(2);
    expect(parsed.client_op_id).toBe("c1");
  });
});
