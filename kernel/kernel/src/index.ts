import type { PgRepositories } from "./ports/index.ts";
import { nullPgRepositories } from "./adapters/null.ts";
import type { HookRegistry } from "@freeanima/kernel-hooks";
import type { EventBus } from "@freeanima/kernel-eventbus";
import type { Logger } from "@freeanima/kernel-logging";

let boundKernel: Kernel | null = null;

/** 由 service/bootstrap 在启动时绑定全局 Kernel 实例 */
export function bindKernel(kernel: Kernel): void {
  boundKernel = kernel;
}

/** 获取已绑定的 Kernel（engine / life 经此访问 repos） */
export function getKernel(): Kernel {
  if (!boundKernel) {
    throw new Error("Kernel 未绑定：请先由 service/bootstrap 调用 bindKernel()");
  }
  return boundKernel;
}

/** 测试 / 集成测注入 Kernel */
export function bindKernelForTest(kernel: Kernel): void {
  boundKernel = kernel;
}

export function resetKernelBinding(): void {
  boundKernel = null;
}

/** 内核组合视图 */
export class Kernel {
  private _eventBus: EventBus;
  private _repos: PgRepositories = nullPgRepositories;

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

  get repos(): PgRepositories {
    return this._repos;
  }

  setRepositories(repos: PgRepositories): void {
    this._repos = repos;
  }
}

export type { PgRepositories, SessionStorePort, SessionSummaryRow } from "./ports/index.ts";
export { nullPgRepositories } from "./adapters/null.ts";
