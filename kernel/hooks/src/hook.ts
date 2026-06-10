// --- Result types ---

/** Single-step handler return (handler fills; no prev) */
export type HookStepResult = {
  status: "ok" | "failed";
  /** Effective only with status "ok" true: abort subsequent handlers; reason in message */
  blocked?: boolean;
  message?: string;
  data?: Record<string, unknown>;
};

/** One step after Registry chaining */
export type HookStepLink = HookStepResult & {
  prev?: HookStepLink;
};

export type HookRunMeta = {
  duration_ms: number;
  handlers: number;
};

/** Aggregated result of one run */
export type HookRunResult<P> = {
  context: P;
  /** Chain head = last executed step; effect data on chain steps, read by caller as needed */
  chain: HookStepLink | null;
  status: "ok" | "failed";
  /** Whether chain stopped short due to ok+blocked */
  blocked: boolean;
  /** Short-circuit step message (intercept reason, etc.) */
  blockedMessage?: string;
  meta: HookRunMeta;
};

// --- Hook token ---

/** Hook identity token; created only via createHook */
export abstract class Hook<Payload> {
  /** @internal carries Payload generic; unused at runtime */
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

/** Create Hook token; qualifiedId is unique id; description for display/docs only */
export function createHook<Payload>(qualifiedId: string, description?: string): Hook<Payload> {
  return new HookToken(qualifiedId, description);
}

export type PayloadOf<H> = H extends Hook<infer P> ? P : never;

export type HookHandler<H extends Hook<unknown>> = (
  context: Readonly<PayloadOf<H>>,
) => HookStepResult | void | Promise<HookStepResult | void>;

// --- Result chain queries ---

/** Chain head to tail (last executed handler → first executed handler) */
export function walkHookChain(chain: HookStepLink | null): HookStepLink[] {
  const steps: HookStepLink[] = [];
  let cur: HookStepLink | null = chain;
  while (cur) {
    steps.push(cur);
    cur = cur.prev ?? null;
  }
  return steps;
}

/** From first executed handler to chain head */
export function walkHookChainOldestFirst(chain: HookStepLink | null): HookStepLink[] {
  return walkHookChain(chain).toReversed();
}

/** First ok+blocked step message from chain head direction */
export function blockedMessageFromChain(chain: HookStepLink | null): string | undefined {
  if (!chain) return undefined;
  for (const step of walkHookChain(chain)) {
    if (step.status === "ok" && step.blocked) {
      return step.message;
    }
  }
  return undefined;
}

/** First ok step with data from chain head (usually last executed handler) */
export function headOkStepData(chain: HookStepLink | null): Record<string, unknown> | undefined {
  for (const step of walkHookChain(chain)) {
    if (step.status === "ok" && step.data) {
      return step.data;
    }
  }
  return undefined;
}
