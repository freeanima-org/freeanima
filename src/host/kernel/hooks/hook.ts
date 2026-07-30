import { QualifiedToken } from "../token/index.ts";

// --- Result types ---

/** Single-step handler return (handler fills; no prev) */
export type HookStepResult<Effect extends Record<string, unknown> = Record<string, unknown>> = {
  status: "ok" | "failed";
  /** Effective only with status "ok" true: abort subsequent handlers; reason in message */
  blocked?: boolean;
  message?: string;
  data?: Effect;
};

/** One step after Registry chaining */
export type HookStepLink<Effect extends Record<string, unknown> = Record<string, unknown>> =
  HookStepResult<Effect> & {
    prev?: HookStepLink<Effect>;
  };

export type HookRunMeta = {
  duration_ms: number;
  handlers: number;
};

/** Aggregated result of one run */
export type HookRunResult<P, Effect extends Record<string, unknown> = Record<string, unknown>> = {
  context: P;
  /** Chain head = last executed step; effect data on chain steps, read by caller as needed */
  chain: HookStepLink<Effect> | null;
  status: "ok" | "failed";
  /** Whether chain stopped short due to ok+blocked */
  blocked: boolean;
  /** Short-circuit step message (intercept reason, etc.) */
  blockedMessage?: string;
  meta: HookRunMeta;
};

// --- LLM kind (prompt / lifecycle scoping) ---

/** Actual run kind passed into handlers (never `all`) */
export type LlmKind = "auto_llm" | "conversation";

/** Registration filter: `all` matches every run */
export type LlmKindScope = LlmKind | "all";

export function matchesLlmKindScope(registered: LlmKindScope, run: LlmKind): boolean {
  return registered === "all" || registered === run;
}

// --- Hook token ---

/** Hook identity token; created only via createHook */
export abstract class Hook<
  Payload,
  Effect extends Record<string, unknown> = Record<string, unknown>,
> extends QualifiedToken<Payload> {
  /** @internal carries Effect generic; unused at runtime */
  declare protected readonly _effectBrand?: Effect;

  protected constructor(qualifiedId: string, description?: string) {
    super(qualifiedId, description);
  }
}

class HookToken<
  Payload,
  Effect extends Record<string, unknown> = Record<string, unknown>,
> extends Hook<Payload, Effect> {
  // oxlint-disable-next-line eslint/no-useless-constructor -- forwards to protected Hook constructor
  constructor(qualifiedId: string, description?: string) {
    super(qualifiedId, description);
  }
}

/** Create Hook token; qualifiedId is unique id; description for display/docs only */
export function createHook<
  Payload,
  Effect extends Record<string, unknown> = Record<string, unknown>,
>(qualifiedId: string, description?: string): Hook<Payload, Effect> {
  return new HookToken(qualifiedId, description);
}

export type PayloadOf<H> = H extends Hook<infer P, infer _E> ? P : never;

export type HookEffectOf<H> = H extends Hook<unknown, infer E> ? E : never;

/** Handler / subscriber context: payload plus the run's {@link LlmKind} */
export type HookHandlerContext<H extends Hook<unknown, Record<string, unknown>>> = Readonly<
  PayloadOf<H> & { llm_kind: LlmKind }
>;

export type HookHandler<H extends Hook<unknown, Record<string, unknown>>> = (
  context: HookHandlerContext<H>,
) => HookStepResult<HookEffectOf<H>> | void | Promise<HookStepResult<HookEffectOf<H>> | void>;

/** Side-channel observer; return value ignored; not awaited by {@link HookRegistry.run} */
export type HookSubscriber<H extends Hook<unknown, Record<string, unknown>>> = (
  context: HookHandlerContext<H>,
) => void | Promise<void>;

export type HookRegisterOpts = {
  priority?: number;
  /** Required. Restricts which {@link LlmKind} runs invoke this handler (`all` = every run). */
  llm_kind: LlmKindScope;
};

export type HookRunOpts = {
  /** Required. Concrete kind for this dispatch (never `all`). */
  llm_kind: LlmKind;
};

// --- Result chain queries ---

/** Chain head to tail (last executed handler → first executed handler) */
export function walkHookChain<Effect extends Record<string, unknown> = Record<string, unknown>>(
  chain: HookStepLink<Effect> | null,
): HookStepLink<Effect>[] {
  const steps: HookStepLink<Effect>[] = [];
  let cur: HookStepLink<Effect> | null = chain;
  while (cur) {
    steps.push(cur);
    cur = cur.prev ?? null;
  }
  return steps;
}

/** From first executed handler to chain head */
export function walkHookChainOldestFirst<
  Effect extends Record<string, unknown> = Record<string, unknown>,
>(chain: HookStepLink<Effect> | null): HookStepLink<Effect>[] {
  return walkHookChain(chain).toReversed();
}

/** First ok+blocked step message from chain head direction */
export function blockedMessageFromChain<
  Effect extends Record<string, unknown> = Record<string, unknown>,
>(chain: HookStepLink<Effect> | null): string | undefined {
  if (!chain) return undefined;
  for (const step of walkHookChain(chain)) {
    if (step.status === "ok" && step.blocked) {
      return step.message;
    }
  }
  return undefined;
}

/** First ok step with data from chain head (usually last executed handler) */
export function headOkStepData<H extends Hook<unknown, Record<string, unknown>>>(
  hook: H,
  chain: HookStepLink<HookEffectOf<H>> | null,
): HookEffectOf<H> | undefined {
  void hook;
  for (const step of walkHookChain(chain)) {
    if (step.status === "ok" && step.data) {
      return step.data;
    }
  }
  return undefined;
}
