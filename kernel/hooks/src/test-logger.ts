import { createLogger } from "@freeanima/logging";
import { createMemorySink, type MemorySink } from "@freeanima/logging/sinks/memory";
import { createNullSink } from "@freeanima/logging/sinks/null";
import type { Logger } from "@freeanima/logging";
import { HookRegistry } from "./registry.js";

export function createNullLogger(): Logger {
  return createLogger({ level: "debug", sinks: [createNullSink()] });
}

export function createMemoryLogger(): { logger: Logger; memory: MemorySink } {
  const memory = createMemorySink();
  const logger = createLogger({ level: "debug", sinks: [memory] });
  return { logger, memory };
}

export function createTestRegistry(): {
  registry: HookRegistry;
  memory: MemorySink;
} {
  const { logger, memory } = createMemoryLogger();
  return { registry: new HookRegistry(logger), memory };
}
