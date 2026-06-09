import { createLogger } from "@freeanima/kernel-logging";
import { createNullSink } from "@freeanima/kernel-logging/null";
import { EventBus } from "./event-bus.ts";
import { MemoryEventQueue } from "./adapters/memory.ts";

/** 单元测默认 EventBus：NullSink + 内存队列 */
export function createTestEventBus(): EventBus {
  const logger = createLogger({ sinks: [createNullSink()] });
  return new EventBus(logger, new MemoryEventQueue());
}
