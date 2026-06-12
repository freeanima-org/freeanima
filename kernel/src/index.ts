import { HookRegistry } from "./hooks/index.ts";
import { EventBus } from "./eventbus/index.ts";
import { MemoryEventQueue } from "./eventbus/adapters/memory.ts";
import { createLogger } from "./logging/index.ts";
import { createConsoleSink } from "./logging/sinks/console.ts";
import type { HookRegistry as HookRegistryType } from "./hooks/index.ts";
import type { EventBus as EventBusType } from "./eventbus/index.ts";
import type { Logger } from "./logging/index.ts";

export type KernelDeps = {
  hookRegistry?: HookRegistryType;
  logger?: Logger;
  eventBus?: EventBusType;
};

function defaultLogger(): Logger {
  return createLogger({ sinks: [createConsoleSink()] });
}

/** Construct Kernel; omitted deps use safe defaults (console logger, memory EventBus) */
export function createKernel(deps: KernelDeps = {}): Kernel {
  const logger = deps.logger ?? defaultLogger();
  const hookRegistry = deps.hookRegistry ?? new HookRegistry(logger);
  const eventBus = deps.eventBus ?? new EventBus(logger, new MemoryEventQueue());
  return new Kernel(hookRegistry, logger, eventBus);
}

/** Kernel composition view (hooks / logger / eventBus) */
export class Kernel {
  constructor(
    readonly hookRegistry: HookRegistryType,
    readonly logger: Logger,
    private _eventBus: EventBusType,
  ) {}

  get eventBus(): EventBusType {
    return this._eventBus;
  }

  setEventBus(bus: EventBusType): void {
    this._eventBus = bus;
  }
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
  EventBus,
  EventTopic,
  EventHandler,
  PayloadOf as EventPayloadOf,
  DispatchOutcome,
  EventQueueAdapter,
  StoredEvent,
} from "./eventbus/index.ts";
export type {
  HookRegistry,
  Hook,
  HookHandler,
  PayloadOf as HookPayloadOf,
  HookEffectOf,
  HookStepResult,
  HookStepLink,
  HookRunResult,
  HookRunMeta,
} from "./hooks/index.ts";
