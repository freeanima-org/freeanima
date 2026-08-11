import { HookRegistry } from "./hooks/index.ts";
import { createLogger } from "./logging/index.ts";
import { createConsoleSink } from "./logging/sinks/console.ts";
import type { HookRegistry as HookRegistryType } from "./hooks/index.ts";
import type { Logger } from "./logging/index.ts";

export type KernelDeps = {
  hookRegistry?: HookRegistryType;
  logger?: Logger;
};

function defaultLogger(): Logger {
  return createLogger({ sinks: [createConsoleSink()] });
}

/** Construct Kernel; omitted deps use safe defaults (console logger) */
export function createKernel(deps: KernelDeps = {}): Kernel {
  const logger = deps.logger ?? defaultLogger();
  const hookRegistry = deps.hookRegistry ?? new HookRegistry(logger);
  return new Kernel(hookRegistry, logger);
}

/** Kernel composition view (hooks / logger) */
export class Kernel {
  constructor(
    readonly hookRegistry: HookRegistryType,
    readonly logger: Logger,
  ) {}
}

export type {
  Logger,
  LogLevel,
  LogAttributes,
  LogScope,
  LogRecord,
  LogSink,
  CreateLoggerOptions,
} from "./logging/index.ts";
export type {
  HookRegistry,
  Hook,
  HookHandler,
  HookSubscriber,
  PayloadOf as HookPayloadOf,
  HookEffectOf,
  HookStepResult,
  HookStepLink,
  HookRunResult,
  HookRunMeta,
} from "./hooks/index.ts";
