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

/** 构造 Kernel；未传入的依赖使用安全默认（console logger、内存 EventBus） */
export function createKernel(deps: KernelDeps = {}): Kernel {
  const logger = deps.logger ?? defaultLogger();
  const hookRegistry = deps.hookRegistry ?? new HookRegistry(logger);
  const eventBus = deps.eventBus ?? new EventBus(logger, new MemoryEventQueue());
  return new Kernel(hookRegistry, logger, eventBus);
}

/** 内核组合视图（hooks / logger / eventBus） */
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
