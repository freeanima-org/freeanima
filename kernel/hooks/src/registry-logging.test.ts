import { describe, expect, it } from "bun:test";
import { createHook } from "./hook.js";
import { createTestRegistry } from "./test-logger.js";

describe("HookRegistry 日志", () => {
  it("handler 失败记录 error 并抛出", async () => {
    const testHook = createHook<{ n: number }>("@freeanima/hooks/test/fail");
    const { registry, memory } = createTestRegistry();
    registry.on(testHook, () => {
      throw new Error("boom");
    });
    await expect(registry.run(testHook, { n: 1 })).rejects.toThrow("boom");
    const failed = memory.records.find((r) => r.message === "hook handler 失败");
    expect(failed?.level).toBe("error");
    expect(failed?.attributes.hook).toBe(testHook.qualifiedId);
  });

  it("注册与注销记录 debug", async () => {
    const testHook = createHook<{ n: number }>("@freeanima/hooks/test/register");
    const { registry, memory } = createTestRegistry();
    const off = registry.on(testHook, () => {});
    off();
    expect(memory.records.some((r) => r.message === "注册 hook handler")).toBe(true);
    expect(memory.records.some((r) => r.message === "注销 hook handler")).toBe(true);
  });

  it("无 handler 时记录跳过", async () => {
    const testHook = createHook<{ n: number }>("@freeanima/hooks/test/empty");
    const { registry, memory } = createTestRegistry();
    await registry.run(testHook, { n: 1 });
    expect(memory.records.some((r) => r.message === "hook run 跳过（无 handler）")).toBe(
      true,
    );
  });
});
