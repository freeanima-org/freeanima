import type { RemoteToolsRequestContext } from "@freeanima/shared/rpc-contract";

/**
 * Habitat method dispatch 与 HTTP REST 入口的端口。
 *
 * 实现在组合根（`server/habitat/*`）；outpost transport 只经端口调用，
 * 不再 import server。未注入时调用方应视作不可用。
 */
export type HabitatDispatchFn = (
  deps: unknown,
  method: string,
  payload: unknown,
  ctx: RemoteToolsRequestContext,
) => Promise<unknown>;

export type HabitatRestHandlerFn = (req: Request, deps: unknown) => Promise<Response>;

let dispatch: HabitatDispatchFn | null = null;
let restHandler: HabitatRestHandlerFn | null = null;

export function registerHabitatDispatch(fn: HabitatDispatchFn): void {
  dispatch = fn;
}

export function habitatDispatchPort(): HabitatDispatchFn | null {
  return dispatch;
}

export function registerHabitatRestHandler(fn: HabitatRestHandlerFn): void {
  restHandler = fn;
}

export function habitatRestHandlerPort(): HabitatRestHandlerFn | null {
  return restHandler;
}

/** @internal 测试隔离 */
export function resetHabitatPortsForTest(): void {
  dispatch = null;
  restHandler = null;
}
