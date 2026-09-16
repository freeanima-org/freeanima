import { createHookContext } from "@freeanima/habitat/core/hooks/cordis";
import { createLogger } from "@freeanima/habitat/kernel/logging";
import { createConsoleSink } from "@freeanima/habitat/kernel/logging/sinks/console.ts";
import { createKernel, type Kernel } from "@freeanima/habitat/kernel";
import type { Config } from "@freeanima/habitat/core/config";

/** Build Kernel for service (logger + Cordis hook context) */
export function createServiceKernel(_config: Config): Kernel {
  const logger = createLogger({ sinks: [createConsoleSink()] });
  return createKernel({
    logger,
    ctx: createHookContext(logger),
  });
}
