import { describe, expect, it } from "bun:test";
import { createHook, Hook, HookRegistry } from "./index";
import type { HookHandler, PayloadOf } from "./index";

describe("index 导出", () => {
  it("导出 Hook、createHook、HookRegistry", () => {
    expect(Hook).toBeDefined();
    expect(createHook).toBeTypeOf("function");
    expect(HookRegistry).toBeTypeOf("function");
  });

  it("公开 API 可组合使用", async () => {
    const hook = createHook<{ count: number }>("@freeanima/hooks/test/index");
    const registry = new HookRegistry();

    const handler: HookHandler<typeof hook> = (payload) => {
      payload.count += 1;
    };
    type Payload = PayloadOf<typeof hook>;
    const initial: Payload = { count: 0 };

    registry.on(hook, handler);
    const result = await registry.run(hook, initial);
    expect(result.count).toBe(1);
  });
});
