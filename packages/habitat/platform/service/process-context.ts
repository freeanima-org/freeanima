import type { Context } from "cordis";
import {
  createHookContext,
  setHookLogger,
  type HookLogger,
} from "@freeanima/habitat/core/hooks/cordis";

const GLOBAL_KEY = Symbol.for("@freeanima/process-context");

type GlobalStore = typeof globalThis & { [GLOBAL_KEY]?: Context };

let moduleCtx: Context | undefined;

/**
 * Process-wide Cordis root context, created before the boot phases run.
 *
 * `createServiceKernel` adopts this context so every service and hook listener
 * shares one context; module-level singletons resolve services from here.
 * Uses the same module + `globalThis` duality the runtime context uses to
 * survive duplicated bundles (SSR / integration harness).
 */
export function ensureProcessContext(logger?: HookLogger): Context {
  const existing = getProcessContext();
  if (existing) {
    if (logger) setHookLogger(existing, logger);
    return existing;
  }
  const ctx = createHookContext(logger);
  moduleCtx = ctx;
  (globalThis as GlobalStore)[GLOBAL_KEY] = ctx;
  return ctx;
}

export function getProcessContext(): Context | null {
  return moduleCtx ?? (globalThis as GlobalStore)[GLOBAL_KEY] ?? null;
}

export function resetProcessContextForTests(): void {
  moduleCtx = undefined;
  delete (globalThis as GlobalStore)[GLOBAL_KEY];
}
