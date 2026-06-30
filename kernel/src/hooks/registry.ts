import type { Logger } from "../logging/index.ts";
import { errMessage } from "../token/index.ts";
import {
  blockedMessageFromChain,
  Hook,
  type HookEffectOf,
  type HookHandler,
  type HookRunMeta,
  type HookRunResult,
  type HookStepLink,
  type HookStepResult,
  type PayloadOf,
} from "./hook.ts";

type RegisteredHandler = {
  handler: HookHandler<Hook<unknown, Record<string, unknown>>>;
  priority: number;
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

/** Sync Hook registry; instantiated by kernel / service; no global singleton */
export class HookRegistry {
  private handlers: Map<symbol, RegisteredHandler[]>;
  private readonly log: Logger;

  constructor(logger: Logger) {
    this.handlers = new Map<symbol, RegisteredHandler[]>();
    this.log = logger.with({ component: "hooks" });
  }

  on<H extends Hook<unknown, Record<string, unknown>>>(
    hook: H,
    handler: HookHandler<H>,
    opts?: { priority?: number },
  ): () => void {
    const priority = opts?.priority ?? 100;
    const list = this.handlers.get(hook.id) ?? [];
    const entry: RegisteredHandler = {
      handler: handler as HookHandler<Hook<unknown, Record<string, unknown>>>,
      priority,
    };
    list.push(entry);
    list.sort((a, b) => a.priority - b.priority);
    this.handlers.set(hook.id, list);
    this.log.debug("Register hook handler", { hook: hook.qualifiedId, priority });
    return () => {
      const current = this.handlers.get(hook.id);
      if (!current) return;
      const idx = current.indexOf(entry);
      if (idx >= 0) current.splice(idx, 1);
      if (current.length === 0) this.handlers.delete(hook.id);
      this.log.debug("Unregister hook handler", { hook: hook.qualifiedId, priority });
    };
  }

  async run<H extends Hook<unknown, Record<string, unknown>>>(
    hook: H,
    context: PayloadOf<H>,
  ): Promise<HookRunResult<PayloadOf<H>, HookEffectOf<H>>> {
    const list = this.handlers.get(hook.id) ?? [];
    const started = performance.now();

    this.log.debug("hook run start", {
      hook: hook.qualifiedId,
      handlers: list.length,
    });

    const emptyMeta: HookRunMeta = { duration_ms: 0, handlers: 0 };
    if (list.length === 0) {
      this.log.debug("hook run skipped (no handler)", { hook: hook.qualifiedId });
      return buildRunResult<PayloadOf<H>, HookEffectOf<H>>(context, null, false, false, emptyMeta);
    }

    let chain: HookStepLink<HookEffectOf<H>> | null = null;
    let anyFailed = false;
    let stoppedByBlocked = false;

    let index = 0;
    for (const { handler } of list) {
      try {
        const raw = await (handler as HookHandler<H>)(context);
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

    return buildRunResult<PayloadOf<H>, HookEffectOf<H>>(
      context,
      chain,
      anyFailed,
      stoppedByBlocked,
      meta,
    );
  }
}
