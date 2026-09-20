import { Context } from "cordis";

import { createKernel, type Kernel } from "@freeanima/kernel";
import { createServiceLogger } from "../logging/service-logging.ts";
import { setHookLogger } from "@freeanima/core/hooks/cordis";
import type { Config } from "@freeanima/core/config";

let rootCtx: Context | null = null;

/**
 * 组合根 Cordis context（`serve()` 与 `createServiceKernel()` 共用一份）。
 *
 * 归 server 组合根包持有；不再有进程级 kernel 全局句柄。
 */
export function serviceRootContext(): Context {
  rootCtx ??= new Context();
  return rootCtx;
}

/** Test teardown：丢弃组合根 context。 */
export function resetServiceRootContextForTest(): void {
  rootCtx = null;
}

/** Build Kernel for service (logger + shared composition-root Cordis context) */
export function createServiceKernel(_config: Config): Kernel {
  const logger = createServiceLogger();
  const ctx = serviceRootContext();
  setHookLogger(ctx, logger);
  return createKernel({ logger, ctx });
}
