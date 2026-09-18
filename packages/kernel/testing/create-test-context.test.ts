import { describe, expect, test } from "bun:test";
import { Service, type Context } from "cordis";

import { getRootContext, getRootLogger } from "../index.ts";
import { resetRootContextForTest } from "../context.ts";
import { createLogger } from "../logging/index.ts";
import { createMemorySink } from "../logging/sinks/memory.ts";
import { assertTestContextWired, createTestContext } from "./create-test-context.ts";

/** 测试专用服务（kernel 不允许 import 上层，故就地定义）。 */
class DemoService extends Service {
  calls = 0;

  constructor(ctx: Context) {
    super(ctx, "demo");
  }
}

describe("createTestContext（kernel 统一 harness）", () => {
  test("装配根 context/logger，并可按生产路径挂载服务", async () => {
    const tc = await createTestContext();
    try {
      assertTestContextWired(tc);
      expect(getRootContext()).toBe(tc.ctx);
      expect(getRootLogger()).toBe(tc.logger);

      await tc.mount(DemoService);
      expect(tc.ctx.reflect.get("demo", false)).toBeInstanceOf(DemoService);
    } finally {
      await tc.dispose();
    }
  });

  test("dispose 卸载 fiber 且清空根句柄", async () => {
    const first = await createTestContext();
    const firstCtx = first.ctx;
    await first.mount(DemoService);
    await first.dispose();

    expect(firstCtx.reflect.get("demo", false)).toBeUndefined();
    expect(() => getRootContext()).toThrow(/root context not initialized/);

    const second = await createTestContext();
    try {
      expect(second.ctx).not.toBe(firstCtx);
      assertTestContextWired(second);
    } finally {
      await second.dispose();
      resetRootContextForTest();
    }
  });

  test("可注入内存 sink logger 并断言记录", async () => {
    const sink = createMemorySink();
    const tc = await createTestContext({ logger: createLogger({ sinks: [sink] }) });
    try {
      tc.logger.with({ component: "harness" }).info("hello");
      expect(sink.records.map((r) => r.message)).toContain("hello");
    } finally {
      await tc.dispose();
    }
  });
});
