import { createLogger } from "@freeanima/kernel/logging";
import { createConsoleSink } from "@freeanima/kernel/logging/sinks/console.ts";
import { createKernel, type Kernel } from "@freeanima/kernel";
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
