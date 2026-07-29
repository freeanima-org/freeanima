import { HookRegistry } from "@freeanima/host/kernel/hooks";
import { createKernel, type Kernel } from "@freeanima/host/kernel";
import type { Config } from "@freeanima/host/platform/config";
import { createServiceLogger, setServiceLogger } from "@freeanima/host/platform/logging";

/** Build Kernel for service (logger + HookRegistry) */
export function createServiceKernel(_config: Config): Kernel {
  const logger = createServiceLogger();
  setServiceLogger(logger);
  return createKernel({
    logger,
    hookRegistry: new HookRegistry(logger),
  });
}
