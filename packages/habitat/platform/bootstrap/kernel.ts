import { createLogger } from "@freeanima/habitat/kernel/logging";
import { createConsoleSink } from "@freeanima/habitat/kernel/logging/sinks/console.ts";
import { createKernel, type Kernel } from "@freeanima/habitat/kernel";
import { ensureProcessContext } from "../service/process-context.ts";
import type { Config } from "@freeanima/habitat/core/config";

/** Build Kernel for service (logger + shared process Cordis context) */
export function createServiceKernel(_config: Config): Kernel {
  const logger = createLogger({ sinks: [createConsoleSink()] });
  return createKernel({
    logger,
    ctx: ensureProcessContext(logger),
  });
}
