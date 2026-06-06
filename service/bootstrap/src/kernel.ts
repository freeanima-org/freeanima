import { HookRegistry } from "@freeanima/kernel-hooks";
import { EventBus } from "@freeanima/kernel-eventbus";
import { SqliteEventQueue } from "@freeanima/connectors-eventbus-sqlite";
import { createKernel, type Kernel } from "@freeanima/kernel";
import { createServiceLogger, setServiceLogger } from "@freeanima/service-logging";
import { PATHS } from "@freeanima/service-config";

/** 构造 service 用 Kernel（logger + SQLite EventBus） */
export function createServiceKernel(): Kernel {
  const logger = createServiceLogger();
  setServiceLogger(logger);
  return createKernel({
    logger,
    hookRegistry: new HookRegistry(logger),
    eventBus: new EventBus(logger, new SqliteEventQueue(PATHS.eventsDb)),
  });
}
