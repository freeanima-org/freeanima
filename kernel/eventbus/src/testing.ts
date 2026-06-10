import { createLogger } from "@freeanima/kernel-logging";
import { createNullSink } from "@freeanima/kernel-logging/null";
import { EventBus } from "./event-bus.ts";
import { MemoryEventQueue } from "./adapters/memory.ts";

/** Default unit-test EventBus: NullSink + memory queue */
export function createTestEventBus(): EventBus {
  const logger = createLogger({ sinks: [createNullSink()] });
  return new EventBus(logger, new MemoryEventQueue());
}
