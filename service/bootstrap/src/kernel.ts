import { HookRegistry } from "@freeanima/kernel-hooks";
import { EventBus } from "@freeanima/kernel-eventbus";
import { createKernel, type Kernel } from "@freeanima/kernel";
import { createServiceLogger, setServiceLogger } from "@freeanima/service-logging";
import { createEventQueue } from "./event-queue.ts";

/** 构造 service 用 Kernel（logger + config 选择的 EventBus 队列） */
export function createServiceKernel(): Kernel {
  const logger = createServiceLogger();
  setServiceLogger(logger);
  return createKernel({
    logger,
    hookRegistry: new HookRegistry(logger),
    eventBus: new EventBus(logger, createEventQueue()),
  });
}
