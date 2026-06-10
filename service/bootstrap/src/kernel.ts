import { HookRegistry } from "@freeanima/kernel-hooks";
import { EventBus } from "@freeanima/kernel-eventbus";
import { createKernel, type Kernel } from "@freeanima/kernel";
import { createServiceLogger, setServiceLogger } from "@freeanima/service-logging";
import { createEventQueue } from "./event-queue.ts";

/** Build Kernel for service (logger + EventBus queue from config) */
export function createServiceKernel(): Kernel {
  const logger = createServiceLogger();
  setServiceLogger(logger);
  return createKernel({
    logger,
    hookRegistry: new HookRegistry(logger),
    eventBus: new EventBus(logger, createEventQueue()),
  });
}
