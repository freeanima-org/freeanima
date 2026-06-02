import type { HookRegistry } from "@freeanima/hooks";

/** 内核组合视图（逐步扩展 eventBus / tools 等端口） */
export class Kernel {
  constructor(
    readonly hookRegistry: HookRegistry
  ) {
  }
}