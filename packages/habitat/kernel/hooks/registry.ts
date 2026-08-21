import type { Logger } from "../logging/index.ts";
import { errMessage } from "../token/index.ts";
import {
  blockedMessageFromChain,
  Hook,
  matchesLlmKindScope,
  type HookEffectOf,
  type HookHandler,
  type HookHandlerContext,
  type HookRegisterOpts,
  type HookRunMeta,
  type HookRunOpts,
  type HookRunResult,
  type HookStepLink,
  type HookStepResult,
  type HookSubscriber,
  type LlmKind,
  type LlmKindScope,
  type PayloadOf,
} from "./hook.ts";

type RegisteredHandler = {
  handler: HookHandler<Hook<unknown>>;
  priority: number;
  llm_kind: LlmKindScope;
};

type RegisteredSubscriber = {
  handler: HookSubscriber<Hook<unknown>>;
  llm_kind: LlmKindScope;
};

function normalizeStep<Effect extends Record<string, unknown>>(
  raw: HookStepResult<Effect> | void,
): HookStepResult<Effect> {
  if (!raw) return { status: "ok" };
  return raw;
}

function linkStep<Effect extends Record<string, unknown>>(
  step: HookStepResult<Effect>,
  prev: HookStepLink<Effect> | null,
): HookStepLink<Effect> {
  return prev ? { ...step, prev } : { ...step };
}

function shouldStopChain(step: HookStepResult): boolean {
  return step.status === "ok" && step.blocked === true;
}

function buildRunResult<P, Effect extends Record<string, unknown>>(
  context: P,
  chain: HookStepLink<Effect> | null,
  anyFailed: boolean,
  stoppedByBlocked: boolean,
  meta: HookRunMeta,
): HookRunResult<P, Effect> {
  const blockedMessage = stoppedByBlocked ? blockedMessageFromChain(chain) : undefined;
  return {
    context,
    chain,
    status: anyFailed ? "failed" : "ok",
    blocked: stoppedByBlocked,
    ...(blockedMessage !== undefined ? { blockedMessage } : {}),
    meta,
  };
}

/** In-process hook registry: `on` = intercept (await), `subscribe` = side-channel (no await). */
export class HookRegistry {
  private handlers: Map<symbol, RegisteredHandler[]>;
  private subscribers: Map<symbol, RegisteredSubscriber[]>;
  private readonly log: Logger;

  constructor(logger: Logger) {
    this.handlers = new Map<symbol, RegisteredHandler[]>();
    this.subscribers = new Map();
    this.log = logger.with({ component: "hooks" });
  }

  on<H extends Hook<unknown>>(
    hook: H,
    handler: HookHandler<H>,
    opts: HookRegisterOpts,
  ): () => void {
    const priority = opts.priority ?? 100;
    const llm_kind = opts.llm_kind;
    const list = this.handlers.get(hook.id) ?? [];
    const entry: RegisteredHandler = {
      handler,
      priority,
      llm_kind,
    };
    list.push(entry);
    list.sort((a, b) => a.priority - b.priority);
    this.handlers.set(hook.id, list);
    this.log.debug("Register hook handler", {
      hook: hook.qualifiedId,
      priority,
      llm_kind,
    });
    return () => {
      const current = this.handlers.get(hook.id);
      if (!current) return;
      const idx = current.indexOf(entry);
      if (idx >= 0) current.splice(idx, 1);
      if (current.length === 0) this.handlers.delete(hook.id);
      this.log.debug("Unregister hook handler", {
        hook: hook.qualifiedId,
        priority,
        llm_kind,
      });
    };
  }

  /** Side-channel observer; invoked during {@link run} without awaiting (errors logged). */
  subscribe<H extends Hook<unknown>>(
    hook: H,
    handler: HookSubscriber<H>,
    opts: Pick<HookRegisterOpts, "llm_kind">,
  ): () => void {
    const llm_kind = opts.llm_kind;
    const list = this.subscribers.get(hook.id) ?? [];
    const entry: RegisteredSubscriber = {
      handler,
      llm_kind,
    };
    list.push(entry);
    this.subscribers.set(hook.id, list);
    this.log.debug("Register hook subscriber", { hook: hook.qualifiedId, llm_kind });
    return () => {
      const current = this.subscribers.get(hook.id);
      if (!current) return;
      const idx = current.indexOf(entry);
      if (idx >= 0) current.splice(idx, 1);
      if (current.length === 0) this.subscribers.delete(hook.id);
      this.log.debug("Unregister hook subscriber", { hook: hook.qualifiedId, llm_kind });
    };
  }

  /**
   * Await intercept (`on`) handlers, then fire-and-forget `subscribe` handlers.
   * No queue — subscribers are started immediately and not awaited.
   * Handlers filtered by registration `llm_kind`; context always includes run `llm_kind`.
   */
  async run<H extends Hook<unknown>>(
    hook: H,
    context: PayloadOf<H>,
    opts: HookRunOpts,
  ): Promise<HookRunResult<HookHandlerContext<H>, HookEffectOf<H>>> {
    const llm_kind = opts.llm_kind;
    // PayloadOf<H> 在 H extends Hook<unknown> 时为 unknown，不可直接 spread
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- PayloadOf 与 llm_kind 组合为 HandlerContext
    const enriched = { ...(context as object), llm_kind } as HookHandlerContext<H>;
    const list = (this.handlers.get(hook.id) ?? []).filter((h) =>
      matchesLlmKindScope(h.llm_kind, llm_kind),
    );
    const started = performance.now();

    this.log.debug("hook run start", {
      hook: hook.qualifiedId,
      llm_kind,
      handlers: list.length,
      subscribers: this.subscribers.get(hook.id)?.length ?? 0,
    });

    let chain: HookStepLink<HookEffectOf<H>> | null = null;
    let anyFailed = false;
    let stoppedByBlocked = false;

    let index = 0;
    for (const { handler } of list) {
      try {
        const raw = await (handler as HookHandler<H>)(enriched);
        const step = normalizeStep<HookEffectOf<H>>(raw);
        chain = linkStep(step, chain);
        if (step.status === "failed") anyFailed = true;
        this.log.debug("hook handler done", {
          hook: hook.qualifiedId,
          index,
          step_status: step.status,
          blocked: shouldStopChain(step),
        });
        if (shouldStopChain(step)) {
          stoppedByBlocked = true;
          break;
        }
      } catch (err) {
        const step: HookStepResult<HookEffectOf<H>> = {
          status: "failed",
          message: errMessage(err),
        };
        chain = linkStep(step, chain);
        anyFailed = true;
        this.log.error("hook handler unhandled exception", {
          hook: hook.qualifiedId,
          index,
          err,
          message: step.message,
        });
      }
      index++;
    }

    this.fireSubscribers(hook, enriched, llm_kind);

    const meta: HookRunMeta = {
      duration_ms: performance.now() - started,
      handlers: list.length,
    };
    this.log.debug("hook run end", {
      hook: hook.qualifiedId,
      ...meta,
      run_status: anyFailed ? "failed" : "ok",
      blocked: stoppedByBlocked,
    });

    return buildRunResult<HookHandlerContext<H>, HookEffectOf<H>>(
      enriched,
      chain,
      anyFailed,
      stoppedByBlocked,
      meta,
    );
  }

  /** Fire-and-forget notify; same as `void run(...)` (ignores intercept result). */
  emit<H extends Hook<unknown>>(hook: H, context: PayloadOf<H>, opts: HookRunOpts): void {
    void this.run(hook, context, opts);
  }

  private fireSubscribers<H extends Hook<unknown>>(
    hook: H,
    context: HookHandlerContext<H>,
    llm_kind: LlmKind,
  ): void {
    const list = (this.subscribers.get(hook.id) ?? []).filter((s) =>
      matchesLlmKindScope(s.llm_kind, llm_kind),
    );
    if (list.length === 0) return;
    this.log.debug("hook subscribers fire", {
      hook: hook.qualifiedId,
      llm_kind,
      subscribers: list.length,
    });
    let index = 0;
    for (const { handler } of list) {
      const i = index;
      void Promise.resolve()
        .then(() => (handler as HookSubscriber<H>)(context))
        .catch((err: unknown) => {
          this.log.error("hook subscriber unhandled exception", {
            hook: hook.qualifiedId,
            index: i,
            err,
            message: errMessage(err),
          });
        });
      index++;
    }
  }
}
