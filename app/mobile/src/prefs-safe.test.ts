import { expect, test } from "bun:test";

import { withPromiseTimeout } from "./prefs-safe.ts";

test("withPromiseTimeout 在超时后拒绝", async () => {
  await expect(
    withPromiseTimeout(new Promise<string>(() => {}), 30, "测试操作"),
  ).rejects.toThrow("测试操作超时（30ms）");
});

test("withPromiseTimeout 正常完成时不触发超时", async () => {
  await expect(withPromiseTimeout(Promise.resolve("ok"), 500, "测试操作")).resolves.toBe("ok");
});
