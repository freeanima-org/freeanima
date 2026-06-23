import { describe, it, expect } from "bun:test";
import {
  createSessionBodySchema,
  sendMessageBodySchema,
  memorySearchBodySchema,
  taskListBodySchema,
} from "./api/schemas.ts";

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

  it("requires platform on create session", () => {
    expect(createSessionBodySchema.safeParse({}).success).toBe(false);
    expect(createSessionBodySchema.safeParse({ platform: "sap:parlor:test" }).success).toBe(true);
  });

  it("validates task list body", () => {
    const ok = taskListBodySchema.safeParse({
      query: "test",
      offset: 0,
      limit: 20,
      status: "all",
      priority: "high",
    });
    expect(ok.success).toBe(true);

    const singleStatus = taskListBodySchema.safeParse({ status: "pending" });
    expect(singleStatus.success).toBe(true);
  });
});
