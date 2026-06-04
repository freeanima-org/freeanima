// --- 结果类型 ---

/** 单步 handler 返回值（handler 填写；不含 prev） */
export type HookStepResult = {
  status: "ok" | "failed";
  /** 仅在与 status "ok" 同时为 true 时生效：中止后续 handler；说明写在 message */
  blocked?: boolean;
  message?: string;
  data?: Record<string, unknown>;
};

/** Registry 串联后的一步 */
export type HookStepLink = HookStepResult & {
  prev?: HookStepLink;
};

export type HookRunMeta = {
  duration_ms: number;
  handlers: number;
};

/** 一次 run 的聚合结果 */
export type HookRunResult<P> = {
  context: P;
  /** 链头 = 最后执行的 step；效应数据在链上各步 data，由调用方按需读取 */
  chain: HookStepLink | null;
  status: "ok" | "failed";
  /** 是否因 ok+blocked 短路停链 */
  blocked: boolean;
  /** 短路步的 message（拦截原因等） */
  blockedMessage?: string;
  meta: HookRunMeta;
};

// --- Hook token ---

/** Hook 身份 token；仅通过 createHook 创建 */
export abstract class Hook<Payload> {
  /** @internal 携带 Payload 泛型，运行时不使用 */
  declare protected readonly _payloadBrand?: Payload;

  readonly id: symbol;
  readonly qualifiedId: string;
  readonly description?: string;

  protected constructor(qualifiedId: string, description?: string) {
    this.id = Symbol(qualifiedId);
    this.qualifiedId = qualifiedId;
    if (description !== undefined) {
      this.description = description;
    }
  }
}

class HookToken<Payload> extends Hook<Payload> {
  constructor(qualifiedId: string, description?: string) {
    super(qualifiedId, description);
  }
}

/** 创建 Hook token；qualifiedId 为唯一标识，description 仅用于展示或文档 */
export function createHook<Payload>(qualifiedId: string, description?: string): Hook<Payload> {
  return new HookToken(qualifiedId, description);
}

export type PayloadOf<H> = H extends Hook<infer P> ? P : never;

export type HookHandler<H extends Hook<unknown>> = (
  context: Readonly<PayloadOf<H>>,
) => HookStepResult | void | Promise<HookStepResult | void>;

// --- 结果链查询 ---

/** 从链头到链尾（最后执行的 handler → 最先执行的 handler） */
export function walkHookChain(chain: HookStepLink | null): HookStepLink[] {
  const steps: HookStepLink[] = [];
  let cur: HookStepLink | null = chain;
  while (cur) {
    steps.push(cur);
    cur = cur.prev ?? null;
  }
  return steps;
}

/** 从最先执行的 handler 到链头 */
export function walkHookChainOldestFirst(chain: HookStepLink | null): HookStepLink[] {
  return walkHookChain(chain).toReversed();
}

/** 链头方向第一个 ok 且 blocked 的步的 message */
export function blockedMessageFromChain(chain: HookStepLink | null): string | undefined {
  if (!chain) return undefined;
  for (const step of walkHookChain(chain)) {
    if (step.status === "ok" && step.blocked) {
      return step.message;
    }
  }
  return undefined;
}

/** 链头方向第一个带 data 的 ok 步（通常为最后执行的 handler） */
export function headOkStepData(chain: HookStepLink | null): Record<string, unknown> | undefined {
  for (const step of walkHookChain(chain)) {
    if (step.status === "ok" && step.data) {
      return step.data;
    }
  }
  return undefined;
}
