import type { Logger } from "@freeanima/habitat/kernel/logging";
import {
  ensureProcessContext,
  getProcessContext,
} from "@freeanima/habitat/platform/service/process-context.ts";

import { fallbackRuntimeLogger, mountRuntimeLoggerService } from "./runtime-logger-service.ts";

/** Composition root: register process logger (same instance as Engine.logger) */
export function registerRuntimeLogger(logger: Logger): void {
  mountRuntimeLoggerService(ensureProcessContext()).setLogger(logger);
}

export function getRuntimeLogger(): Logger {
  return getProcessContext()?.runtimeLogger?.getLogger() ?? fallbackRuntimeLogger;
}

export function resetRuntimeLoggerForTest(): void {
  getProcessContext()?.runtimeLogger?.reset();
}
