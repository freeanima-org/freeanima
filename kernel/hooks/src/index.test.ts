import { describe, expect, it } from "bun:test";
import { createHook, Hook, HookRegistry } from "./index.ts";
import type { HookHandler, PayloadOf } from "./index.ts";
import { createTestHookRegistry } from "./testing.ts";

describe("index exports", () => {
  it("exports Hook, createHook, HookRegistry", () => {
    expect(Hook).toBeDefined();
    expect(createHook).toBeTypeOf("function");
    expect(HookRegistry).toBeTypeOf("function");
  });

  it("public API composes", async () => {
    const hook = createHook<{ count: number }>("@freeanima/kernel-hooks/test/index");
    const registry = createTestHookRegistry();

    const handler: HookHandler<typeof hook> = () => ({
      status: "ok",
      data: { count: 1 },
    });
    type Payload = PayloadOf<typeof hook>;
    const initial: Payload = { count: 0 };

    registry.on(hook, handler);
    const run = await registry.run(hook, initial);
    expect(run.context.count).toBe(0);
    expect(run.chain?.data).toEqual({ count: 1 });
  });
});
