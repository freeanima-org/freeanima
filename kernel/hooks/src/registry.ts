import { HookHandler, PayloadOf } from "./handler";
import { Hook } from "./hook";


type RegisteredHandler = {
  handler: HookHandler<Hook<unknown>>;
  priority: number;
};

/** 同步 Hook 注册表；由 kernel / service 实例化，不提供全局单例 */
export class HookRegistry {
  private handlers: Map<symbol, RegisteredHandler[]>;

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
    return () => {
      const current = this.handlers.get(hook.id);
      if (!current) return;
      const idx = current.indexOf(entry);
      if (idx >= 0) current.splice(idx, 1);
      if (!current.length) this.handlers.delete(hook.id);
    };
  }

  async run<H extends Hook<unknown>>(
    hook: H,
    payload: PayloadOf<H>,
  ): Promise<PayloadOf<H>> {
    const list = this.handlers.get(hook.id) ?? [];
    for (const { handler } of list) {
      await (handler as HookHandler<H>)(payload);
    }
    return payload;
  }

  constructor() {
    this.handlers = new Map<symbol, RegisteredHandler[]>();
  }
}
