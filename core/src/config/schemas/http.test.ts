import { describe, expect, test } from "bun:test";

import { collectHttpCorsOrigins } from "../http-origins.ts";
import { httpConfigSchema, httpCorsOriginSchema } from "./http.ts";

describe("httpCorsOriginSchema", () => {
  test("accepts origin without path", () => {
    expect(httpCorsOriginSchema.safeParse("http://127.0.0.1:4173").success).toBe(true);
    expect(httpCorsOriginSchema.safeParse("https://anima.lan").success).toBe(true);
  });

  test("rejects URL with path", () => {
    expect(httpCorsOriginSchema.safeParse("http://127.0.0.1:4173/web").success).toBe(false);
  });
});

describe("httpConfigSchema", () => {
  test("parses cors_origins", () => {
    const parsed = httpConfigSchema.safeParse({
      cors_origins: ["http://127.0.0.1:4173"],
    });
    expect(parsed.success).toBe(true);
  });
});

describe("collectHttpCorsOrigins", () => {
  test("deduplicates and trims", () => {
    const set = collectHttpCorsOrigins({
      cors_origins: ["http://127.0.0.1:4173", " http://127.0.0.1:4173 "],
    });
    expect([...set]).toEqual(["http://127.0.0.1:4173"]);
  });
});
