import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { resolveValue, resolveCredentialRef } from "./resolve.ts";

describe("resolveValue", () => {
  const prevEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    prevEnv.TEST_RESOLVE_KEY = process.env.TEST_RESOLVE_KEY;
  });

  afterEach(() => {
    if (prevEnv.TEST_RESOLVE_KEY === undefined) delete process.env.TEST_RESOLVE_KEY;
    else process.env.TEST_RESOLVE_KEY = prevEnv.TEST_RESOLVE_KEY;
  });

  it("returns plaintext as-is", async () => {
    await expect(resolveValue("hello")).resolves.toBe("hello");
  });

  it('expands env("KEY")', async () => {
    process.env.TEST_RESOLVE_KEY = "secret";
    await expect(resolveValue('env("TEST_RESOLVE_KEY")')).resolves.toBe("secret");
  });

  it("throws when env missing", async () => {
    delete process.env.TEST_RESOLVE_KEY;
    await expect(resolveValue('env("TEST_RESOLVE_KEY")')).rejects.toThrow(
      /Environment variable TEST_RESOLVE_KEY is not set/,
    );
  });

  it("mixed string concatenation with credential reference", async () => {
    await expect(
      resolveValue('user:credential("email/test-nonexistent-account-xyz", "password")'),
    ).rejects.toThrow();
  });

  it("does not expand pass: shorthand", async () => {
    await expect(resolveValue("pass:api/foo")).resolves.toBe("pass:api/foo");
  });
});

describe("resolveCredentialRef", () => {
  it("returns plaintext as-is", () => {
    expect(resolveCredentialRef("sk-plain-token", "token")).toBe("sk-plain-token");
  });

  it("does not expand pass: shorthand", () => {
    expect(resolveCredentialRef("pass:api/foo", "token")).toBe("pass:api/foo");
  });
});
