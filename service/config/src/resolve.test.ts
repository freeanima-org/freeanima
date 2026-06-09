import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { resolveValue } from "./resolve.ts";

describe("resolveValue", () => {
  const prevEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    prevEnv.TEST_RESOLVE_KEY = process.env.TEST_RESOLVE_KEY;
  });

  afterEach(() => {
    if (prevEnv.TEST_RESOLVE_KEY === undefined) delete process.env.TEST_RESOLVE_KEY;
    else process.env.TEST_RESOLVE_KEY = prevEnv.TEST_RESOLVE_KEY;
  });

  it("明文原样返回", async () => {
    await expect(resolveValue("hello")).resolves.toBe("hello");
  });

  it('展开 env("KEY")', async () => {
    process.env.TEST_RESOLVE_KEY = "secret";
    await expect(resolveValue('env("TEST_RESOLVE_KEY")')).resolves.toBe("secret");
  });

  it("env 缺失时抛错", async () => {
    delete process.env.TEST_RESOLVE_KEY;
    await expect(resolveValue('env("TEST_RESOLVE_KEY")')).rejects.toThrow(
      /环境变量 TEST_RESOLVE_KEY 未设置/,
    );
  });

  it("混合字符串拼接 credential 引用", async () => {
    await expect(
      resolveValue('user:credential("email/test-nonexistent-account-xyz", "password")'),
    ).rejects.toThrow();
  });
});
