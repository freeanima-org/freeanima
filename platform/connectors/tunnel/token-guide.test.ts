import { describe, expect, test } from "bun:test";
import { normalizeApiToken, validateApiTokenShape } from "./token-guide.ts";

describe("token-guide", () => {
  test("normalizeApiToken strips quotes and whitespace", () => {
    expect(normalizeApiToken('  "abc_def"  ')).toBe("abc_def");
  });

  test("rejects tunnel credentials JSON shape", () => {
    const r = validateApiTokenShape('{"AccountTag":"x","TunnelSecret":"y"}');
    expect(r.ok).toBe(false);
  });

  test("rejects likely global API key", () => {
    const r = validateApiTokenShape("a".repeat(37));
    expect(r.ok).toBe(false);
  });
});
