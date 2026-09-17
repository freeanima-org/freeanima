import { createLogger, type Logger } from "./index.ts";
import { createMemorySink } from "./sinks/memory.ts";

/** Default unit-test logger: memory sink, assertable records */
export function createTestLogger(): Logger {
  return createLogger({ sinks: [createMemorySink()] });
}
