import { HookRegistry } from "@freeanima/hooks";
import { EventBus } from "@freeanima/event-bus";
import { SqliteEventQueue } from "@freeanima/event-bus-sqlite";
import { Kernel } from "@freeanima/kernel";
import { createServiceLogger, PATHS, setServiceLogger } from "@freeanima/legacy-kernel";

const logger = createServiceLogger();
setServiceLogger(logger);
const hookRegistry = new HookRegistry(logger);
const eventBus = new EventBus(logger, new SqliteEventQueue(PATHS.eventsDb));

export const kernel = new Kernel(hookRegistry, logger, eventBus);
