import { describe, it, expect } from "bun:test";
import {
  createSessionBodySchema,
  sendMessageBodySchema,
  memorySearchBodySchema,
} from "../../src/api/schemas.ts";

describe("api/schemas", () => {
  it("trims and validates send message body", () => {
    const ok = sendMessageBodySchema.safeParse({ message: "  hello  " });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.message).toBe("hello");

    const bad = sendMessageBodySchema.safeParse({ message: "   " });
    expect(bad.success).toBe(false);
  });

  it("validates memory search query", () => {
    const ok = memorySearchBodySchema.safeParse({ query: "  test  ", limit: 5 });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.query).toBe("test");
  });

  it("accepts optional platform on create session", () => {
    expect(createSessionBodySchema.safeParse({}).success).toBe(true);
    expect(createSessionBodySchema.safeParse({ platform: "parlor" }).success).toBe(true);
  });
});
