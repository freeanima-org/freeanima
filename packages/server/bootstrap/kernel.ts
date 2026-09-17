import { createKernel, ensureRootContext, type Kernel } from "@freeanima/kernel";
import { createServiceLogger } from "../logging/service-logging.ts";
import { setHookLogger } from "@freeanima/core/hooks/cordis";
import type { Config } from "@freeanima/core/config";

/** Build Kernel for service (logger + shared process Cordis root context) */
export function createServiceKernel(_config: Config): Kernel {
  const logger = createServiceLogger();
  const ctx = ensureRootContext();
  setHookLogger(ctx, logger);
  return createKernel({ logger, ctx });
}
