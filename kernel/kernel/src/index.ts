import type { HookRegistry } from "@freeanima/kernel-hooks";
import type { EventBus } from "@freeanima/kernel-eventbus";
import type { Logger } from "@freeanima/kernel-logging";

/** 内核组合视图 */
export class Kernel {
  private _eventBus: EventBus;

  constructor(
    readonly hookRegistry: HookRegistry,
    readonly logger: Logger,
    eventBus: EventBus,
  ) {
    this._eventBus = eventBus;
  }

  get eventBus(): EventBus {
    return this._eventBus;
  }

  setEventBus(bus: EventBus): void {
    this._eventBus = bus;
  }
}
