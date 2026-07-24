import { HookRegistry } from "@freeanima/host/kernel/hooks";
import { EventBus } from "@freeanima/host/kernel/eventbus";
import { createKernel, type Kernel } from "@freeanima/host/kernel";
import type { Config } from "@freeanima/host/platform/config";
import { createServiceLogger, setServiceLogger } from "@freeanima/host/platform/logging";
import { createEventQueue } from "./event-queue.ts";

/** Build Kernel for service (logger + EventBus queue from config) */
export function createServiceKernel(config: Config): Kernel {
  const logger = createServiceLogger();
  setServiceLogger(logger);
  return createKernel({
    logger,
    hookRegistry: new HookRegistry(logger),
    eventBus: new EventBus(logger, createEventQueue(config)),
  });
}
