import { createTestLogger } from "../logging/testing.ts";
import { EventBus } from "./event-bus.ts";
import { MemoryEventQueue } from "./adapters/memory.ts";

/** Default unit-test EventBus: memory sink logger + memory queue */
export function createTestEventBus(): EventBus {
  return new EventBus(createTestLogger(), new MemoryEventQueue());
}
