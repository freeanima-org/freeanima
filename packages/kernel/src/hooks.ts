/** Hook 流式事件子集（与 engine StreamEvent 对齐，kernel 不依赖 engine） */
export type HookClarifyItem = {
  question: string;
  choices?: string[];
  default?: string;
};

export type HookStreamEvent =
  | { event: "awaiting_clarify"; data: { items: HookClarifyItem[]; timeout_sec: number } }
  | { event: "done"; data: { reason?: "awaiting_clarify" } };

export type TurnControl = {
  pause: true;
  streamEvents: HookStreamEvent[];
};

export type MessageIncomingContext = {
  sessionId: string;
  message: string;
  platform: string;
  blocked?: { reason: string };
  transformedMessage?: string;
  expiredHint?: string;
};

export type ToolAfterCallContext = {
  sessionId: string;
  toolName: string;
  args: Record<string, unknown>;
  result: string;
  turnControl?: TurnControl;
};

export type TurnAfterCompleteContext = {
  sessionId: string;
  messages: Record<string, unknown>[];
  displayContent?: string;
};

export type HookMap = {
  "message:incoming": MessageIncomingContext;
  "tool:after_call": ToolAfterCallContext;
  "turn:after_complete": TurnAfterCompleteContext;
};

export type HookName = keyof HookMap;

export type HookHandler<C> = (ctx: C) => void | Promise<void>;

type RegisteredHandler = {
  handler: HookHandler<unknown>;
  priority: number;
};

export class HookRegistry {
  private handlers = new Map<string, RegisteredHandler[]>();

  on<K extends HookName>(
    name: K,
    handler: HookHandler<HookMap[K]>,
    opts?: { priority?: number },
  ): () => void {
    const priority = opts?.priority ?? 100;
    const list = this.handlers.get(name) ?? [];
    const entry: RegisteredHandler = { handler: handler as HookHandler<unknown>, priority };
    list.push(entry);
    list.sort((a, b) => a.priority - b.priority);
    this.handlers.set(name, list);
    return () => {
      const current = this.handlers.get(name);
      if (!current) return;
      const idx = current.indexOf(entry);
      if (idx >= 0) current.splice(idx, 1);
      if (!current.length) this.handlers.delete(name);
    };
  }

  async run<K extends HookName>(name: K, ctx: HookMap[K]): Promise<HookMap[K]> {
    const list = this.handlers.get(name) ?? [];
    for (const { handler } of list) {
      await handler(ctx);
    }
    return ctx;
  }
}

export function createHookRegistry(): HookRegistry {
  return new HookRegistry();
}

/** 进程内默认 Hook 注册表（serve 启动时由扩展包注册 handler） */
export const hooks = createHookRegistry();
