import { describe, expect, test } from "bun:test";

import { parsePublicOrigin, publicConfigSchema } from "./public.ts";

describe("parsePublicOrigin", () => {
  test("接受 http(s) origin 并去尾斜杠", () => {
    expect(parsePublicOrigin("https://anima.example.com")).toBe("https://anima.example.com");
    expect(parsePublicOrigin("https://anima.example.com/")).toBe("https://anima.example.com");
    expect(parsePublicOrigin("http://10.0.0.2:2658")).toBe("http://10.0.0.2:2658");
  });

  test("空与非法返回 undefined", () => {
    expect(parsePublicOrigin("")).toBeUndefined();
    expect(parsePublicOrigin("   ")).toBeUndefined();
    expect(parsePublicOrigin(null)).toBeUndefined();
    expect(parsePublicOrigin("not-a-url")).toBeUndefined();
    expect(parsePublicOrigin("ftp://anima.example.com")).toBeUndefined();
    expect(parsePublicOrigin("https://anima.example.com/web")).toBeUndefined();
    expect(parsePublicOrigin("https://anima.example.com?x=1")).toBeUndefined();
    expect(parsePublicOrigin("https://anima.example.com#frag")).toBeUndefined();
  });
});

describe("publicConfigSchema", () => {
  test("接受合法 origin 并规范化", () => {
    const parsed = publicConfigSchema.safeParse({ origin: "https://anima.example.com/" });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data?.origin).toBe("https://anima.example.com");
    }
  });

  test("空 origin 视为未配置", () => {
    const parsed = publicConfigSchema.safeParse({ origin: "  " });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data?.origin).toBeUndefined();
    }
  });

  test("拒绝带 path 的值", () => {
    const parsed = publicConfigSchema.safeParse({ origin: "https://anima.example.com/web" });
    expect(parsed.success).toBe(false);
  });
});
