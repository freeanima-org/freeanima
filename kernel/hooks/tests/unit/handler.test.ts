import { describe, expectTypeOf, it } from "vitest";
import type { HookHandler, PayloadOf } from "../../src/handler.js";
import { createHook } from "../../src/hook.js";

describe("Handler 类型", () => {
  it("PayloadOf 从 Hook 实例推断负载类型", () => {
    const hook = createHook<{ value: number }>("@freeanima/hooks/test/payload-of");
    type Payload = PayloadOf<typeof hook>;
    expectTypeOf<Payload>().toEqualTypeOf<{ value: number }>();
  });

  it("HookHandler 接收推断后的 payload", () => {
    const hook = createHook<{ ok: boolean }>("@freeanima/hooks/test/handler");
    const handler: HookHandler<typeof hook> = (payload) => {
      expectTypeOf(payload).toEqualTypeOf<{ ok: boolean }>();
    };
    expectTypeOf(handler).parameters.toEqualTypeOf<[{ ok: boolean }]>();
  });
});
