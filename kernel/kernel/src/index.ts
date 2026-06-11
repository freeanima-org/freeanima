import { HookRegistry } from "@freeanima/kernel-hooks";
import { EventBus } from "@freeanima/kernel-eventbus";
import { MemoryEventQueue } from "@freeanima/kernel-eventbus/memory";
import { createLogger } from "@freeanima/kernel-logging";
import { createConsoleSink } from "@freeanima/kernel-logging/console";
import type { HookRegistry as HookRegistryType } from "@freeanima/kernel-hooks";
import type { EventBus as EventBusType } from "@freeanima/kernel-eventbus";
import type { Logger } from "@freeanima/kernel-logging";

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
} from "@freeanima/kernel-logging";
export type {
  EventBus,
  EventTopic,
  EventHandler,
  PayloadOf as EventPayloadOf,
  DispatchOutcome,
  EventQueueAdapter,
  StoredEvent,
} from "@freeanima/kernel-eventbus";
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
} from "@freeanima/kernel-hooks";
