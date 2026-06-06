import { HookRegistry } from "@freeanima/kernel-hooks";
import { EventBus } from "@freeanima/kernel-eventbus";
import { SqliteEventQueue } from "@freeanima/connectors-eventbus-sqlite";
import { bindKernel, Kernel } from "@freeanima/kernel";
import { createServiceLogger, setServiceLogger } from "@freeanima/service-logging";
import { PATHS } from "@freeanima/service-config";

const logger = createServiceLogger();
setServiceLogger(logger);
const hookRegistry = new HookRegistry(logger);
const eventBus = new EventBus(logger, new SqliteEventQueue(PATHS.eventsDb));

export const kernel = new Kernel(hookRegistry, logger, eventBus);
bindKernel(kernel);
