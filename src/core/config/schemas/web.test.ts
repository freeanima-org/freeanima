import { describe, expect, test } from "bun:test";
import { DEFAULT_WEB_PORT, webConfigSchema } from "./web.ts";

describe("webConfigSchema", () => {
  test("accepts minimal web config", () => {
    const parsed = webConfigSchema.safeParse({ enabled: true, port: 2660 });
    expect(parsed.success).toBe(true);
  });

  test("DEFAULT_WEB_PORT is 2660", () => {
    expect(DEFAULT_WEB_PORT).toBe(2660);
  });
});
