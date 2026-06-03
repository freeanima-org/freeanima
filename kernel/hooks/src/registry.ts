import type { Logger } from "@freeanima/logging";
import { HookHandler, PayloadOf } from "./handler.js";
import { Hook } from "./hook.js";
import { logHookRunOutcome } from "./run-log.js";

type RegisteredHandler = {
  handler: HookHandler<Hook<unknown>>;
  priority: number;
};

/** 同步 Hook 注册表；由 kernel / service 实例化，不提供全局单例 */
export class HookRegistry {
  private handlers: Map<symbol, RegisteredHandler[]>;
  private readonly log: Logger;

  constructor(logger: Logger) {
    this.handlers = new Map<symbol, RegisteredHandler[]>();
    this.log = logger.with({ component: "hooks" });
  }

  on<H extends Hook<unknown>>(
    hook: H,
    handler: HookHandler<H>,
    opts?: { priority?: number },
  ): () => void {
    const priority = opts?.priority ?? 100;
    const list = this.handlers.get(hook.id) ?? [];
    const entry: RegisteredHandler = {
      handler: handler as HookHandler<Hook<unknown>>,
      priority,
    };
    list.push(entry);
    list.sort((a, b) => a.priority - b.priority);
    this.handlers.set(hook.id, list);
    this.log.debug("注册 hook handler", { hook: hook.qualifiedId, priority });
    return () => {
      const current = this.handlers.get(hook.id);
      if (!current) return;
      const idx = current.indexOf(entry);
      if (idx >= 0) current.splice(idx, 1);
      if (!current.length) this.handlers.delete(hook.id);
      this.log.debug("注销 hook handler", { hook: hook.qualifiedId, priority });
    };
  }

  async run<H extends Hook<unknown>>(
    hook: H,
    payload: PayloadOf<H>,
  ): Promise<PayloadOf<H>> {
    const list = this.handlers.get(hook.id) ?? [];
    const started = performance.now();

    this.log.debug("hook run 开始", {
      hook: hook.qualifiedId,
      handlers: list.length,
    });

    if (!list.length) {
      this.log.debug("hook run 跳过（无 handler）", { hook: hook.qualifiedId });
      return payload;
    }

    let index = 0;
    for (const { handler } of list) {
      try {
        await (handler as HookHandler<H>)(payload);
        this.log.debug("hook handler 完成", {
          hook: hook.qualifiedId,
          index,
        });
      } catch (err) {
        this.log.error("hook handler 失败", {
          hook: hook.qualifiedId,
          index,
          err,
        });
        throw err;
      }
      index++;
    }

    const meta = { duration_ms: performance.now() - started, handlers: list.length };
    logHookRunOutcome(this.log, hook, payload, meta);
    return payload;
  }
}
