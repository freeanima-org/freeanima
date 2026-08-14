import { HookRegistry } from "@freeanima/habitat/kernel/hooks";
import { createKernel, type Kernel } from "@freeanima/habitat/kernel";
import type { Config } from "@freeanima/habitat/platform/config";
import { createServiceLogger, setServiceLogger } from "@freeanima/habitat/platform/logging";

/** Build Kernel for service (logger + HookRegistry) */
export function createServiceKernel(_config: Config): Kernel {
  const logger = createServiceLogger();
  setServiceLogger(logger);
  return createKernel({
    logger,
    hookRegistry: new HookRegistry(logger),
  });
}
