import { test, expect } from "bun:test";

import { createMobileShellStub, normalizeHubUrl } from "./mobile-shell.ts";

test("normalizeHubUrl 补全 scheme 并去尾斜杠", () => {
  expect(normalizeHubUrl("192.168.1.10:2658")).toBe("http://192.168.1.10:2658");
  expect(normalizeHubUrl("http://192.168.1.10:2658/")).toBe("http://192.168.1.10:2658");
});

test("normalizeHubUrl 拒绝空值", () => {
  expect(() => normalizeHubUrl("  ")).toThrow("Hub 地址不能为空");
});

test("createMobileShellStub 标记 isNativeShell", () => {
  const stub = createMobileShellStub();
  expect(stub.isNativeShell).toBe(true);
  expect(stub.isElectron).toBe(false);
});
