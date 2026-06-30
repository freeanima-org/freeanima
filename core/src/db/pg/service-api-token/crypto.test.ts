import { describe, expect, test } from "bun:test";

import {
  generateServiceApiTokenParts,
  hashServiceApiTokenSecret,
  parseServiceApiToken,
  verifyServiceApiTokenSecret,
} from "./crypto.ts";

describe("service api token crypto", () => {
  test("roundtrip parse generated token", async () => {
    const parts = generateServiceApiTokenParts();
    const parsed = parseServiceApiToken(parts.plaintext);
    expect(parsed?.prefix).toBe(parts.prefix);
    expect(parsed?.secret).toBe(parts.secret);
    const hash = await hashServiceApiTokenSecret(parts.secret);
    expect(await verifyServiceApiTokenSecret(parts.secret, hash)).toBe(true);
    expect(await verifyServiceApiTokenSecret("wrong", hash)).toBe(false);
  });

  test("reject invalid token format", () => {
    expect(parseServiceApiToken("")).toBeNull();
    expect(parseServiceApiToken("Bearer xyz")).toBeNull();
    expect(parseServiceApiToken("fa_at_onlyprefix")).toBeNull();
  });
});
