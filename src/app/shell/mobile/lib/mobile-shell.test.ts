import { test, expect } from "bun:test";

import { createMobileShellStub, normalizeHabitatUrl } from "./mobile-shell.ts";

test("normalizeHabitatUrl 补全 scheme 并去尾斜杠", () => {
  expect(normalizeHabitatUrl("192.168.1.10:2658")).toBe("http://192.168.1.10:2658");
  expect(normalizeHabitatUrl("http://192.168.1.10:2658/")).toBe("http://192.168.1.10:2658");
});

test("normalizeHabitatUrl 拒绝空值", () => {
  expect(() => normalizeHabitatUrl("  ")).toThrow("栖息地地址不能为空");
});

test("createMobileShellStub 标记 isNativeShell", () => {
  const stub = createMobileShellStub();
  expect(stub.isNativeShell).toBe(true);
  expect(stub.isElectron).toBe(false);
});
