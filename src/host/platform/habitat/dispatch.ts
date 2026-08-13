import type { RemoteToolsRequestContext } from "@freeanima/shared/rpc-contract";
import { getHabitatMethodDef, isHabitatMethod } from "@freeanima/shared/habitat-contract";
import { getFeatureRpcHandler } from "../features/registry.ts";
import type { RemoteToolsServerDeps } from "@freeanima/host/capabilities/outpost/transport/types.ts";

export type HabitatDispatchContext = RemoteToolsRequestContext & {
  app_id: string;
  instance_id: string;
  /** HTTP REST 适配器注入；WS 无此字段 */
  httpRequest?: Request;
};

/** 统一 Habitat method dispatch（WS / HTTP 适配器共用入口） */
export async function habitatDispatch(
  deps: RemoteToolsServerDeps,
  method: string,
  payload: unknown,
  ctx: HabitatDispatchContext,
): Promise<unknown> {
  if (!isHabitatMethod(method)) {
    throw new Error(`unknown habitat method: ${String(method)}`);
  }
  const hubMethod = method;
  const def = getHabitatMethodDef(hubMethod);
  const parsedInput = def.input.parse(payload);

  const featureHandler = getFeatureRpcHandler(hubMethod);
  if (featureHandler) {
    return featureHandler(deps, parsedInput, ctx);
  }

  throw new Error(`no handler registered for habitat method: ${method}`);
}
