import { createLogger, type Logger } from "./index.ts";
import { createMemorySink } from "./sinks/memory.ts";

/** 单元测默认 logger：内存 sink，可断言 records */
export function createTestLogger(): Logger {
  return createLogger({ sinks: [createMemorySink()] });
}
