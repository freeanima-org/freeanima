import { Context } from "cordis";

/**
 * Kernel-owned composition-root Cordis context.
 *
 * The process has exactly one root `Context`; `createKernel()` installs it here.
 * Modules that cannot receive `ctx` as an argument (boot ordering, lazily
 * resolved ports) read it through {@link getRootContext} — this is the **single**
 * sanctioned global handle, replacing the previous module+`globalThis` duality
 * (`ensureRootContext` / `getRootContextOrNull`) and the per-port
 * register/unregister registries.
 *
 * Rules:
 *   - services are reached as `getRootContext().<service>`;
 *   - no `globalThis` / `Symbol.for` mirroring (a second bundle must not get a
 *     second context).
 */
let rootContext: Context | null = null;

/** Install the composition-root context (called by `createKernel`). */
export function setRootContext(ctx: Context): void {
  rootContext = ctx;
}

/** The composition-root context, or `null` before `createKernel()`. */
export function getRootContextOrNull(): Context | null {
  return rootContext;
}

/** The composition-root context; throws when used before `createKernel()`. */
export function getRootContext(): Context {
  if (!rootContext) {
    throw new Error("@freeanima/kernel: root context not initialized; call createKernel() first");
  }
  return rootContext;
}

/** Idempotent: reuse the installed context, otherwise create a bare one. */
export function ensureRootContext(): Context {
  return rootContext ?? (rootContext = new Context());
}

/** Test isolation: drop the installed context. */
export function resetRootContextForTest(): void {
  rootContext = null;
}
