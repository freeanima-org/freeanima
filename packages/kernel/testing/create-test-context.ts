import { Context, type Fiber } from "cordis";

import { createHookContext, setHookLogger } from "../hooks/host.ts";
import { getRootContext, resetRootContextForTest, setRootContext } from "../context.ts";
import { getRootLogger, resetRootLoggerForTest, setRootLogger } from "../logging/root-logger.ts";
import { createTestLogger } from "../logging/testing.ts";
import { createKernel, type Kernel } from "../index.ts";
import type { Logger } from "../logging/index.ts";

/**
 * 统一测试上下文（单一 harness）。
 *
 * 生产只有一条组合路径：`createServiceKernel` → `createKernel({ ctx, logger })`
 * 安装进程根 context/logger，各服务经 `ctx.plugin(...)` 或幂等 `mountXService(ctx)`
 * 挂载。测试此前各写各的（裸 `new Context()` / 直接调 mount 助手 + 手工 reset），
 * 本 harness 把同一路径固定下来：
 *
 * ```ts
 * const tc = await createTestContext();
 * mountSystemPromptService(tc.ctx, {});
 * // ... 断言
 * await tc.dispose();
 * ```
 *
 * 放在 kernel 是为了让**每一层**（core/engine/capabilities/features/server/cli 与
 * 前端不便用）都能 import——harness 本身只依赖 Context + logger。
 */
type PluginArgs = Parameters<Context["plugin"]>;

export type TestContextOptions = {
  /** 覆盖 logger（默认内存 sink，可注入自建 sink 断言记录）。 */
  logger?: Logger;
  /** 在新鲜 context 上挂载被测服务（与生产同一批 mount 助手）。 */
  mount?: (ctx: Context, kernel: Kernel) => void | Promise<void>;
};

export type TestContext = {
  ctx: Context;
  kernel: Kernel;
  logger: Logger;
  /** 经 harness 挂载的 Cordis 插件（dispose 时按逆序卸载）。 */
  mount: (...args: PluginArgs) => Promise<Fiber>;
  dispose: () => Promise<void>;
};

export async function createTestContext(options: TestContextOptions = {}): Promise<TestContext> {
  resetRootContextForTest();
  resetRootLoggerForTest();

  const logger = options.logger ?? createTestLogger();
  const ctx = createHookContext(logger);
  setHookLogger(ctx, logger);
  setRootContext(ctx);
  setRootLogger(logger);
  const kernel = createKernel({ ctx, logger });

  const fibers: Fiber[] = [];
  const mount = async (...args: PluginArgs): Promise<Fiber> => {
    const fiber = await ctx.plugin(...args);
    fibers.push(fiber);
    return fiber;
  };

  if (options.mount) await options.mount(ctx, kernel);

  return {
    ctx,
    kernel,
    logger,
    mount,
    dispose: async () => {
      for (const fiber of fibers.toReversed()) {
        await fiber.dispose();
      }
      resetRootContextForTest();
      resetRootLoggerForTest();
    },
  };
}

/** 断言 harness 装配正确（自身测试与冒烟复用）。 */
export function assertTestContextWired(tc: TestContext): void {
  if (getRootContext() !== tc.ctx) {
    throw new Error("createTestContext: root context is not the harness context");
  }
  if (getRootLogger() !== tc.logger) {
    throw new Error("createTestContext: root logger is not the harness logger");
  }
}
