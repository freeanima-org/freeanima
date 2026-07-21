import type { RpcMethod, RemoteToolsRequestContext } from "@freeanima/shared/rpc-contract";
import { getHubMethodDef, isHubMethod, type HubMethod } from "@freeanima/shared/habitat-contract";
import { getFeatureRpcHandler } from "../features/registry.ts";
import type { RemoteToolsServerDeps } from "../remote-tools/types.ts";

export type HubDispatchContext = RemoteToolsRequestContext & {
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
  ctx: HubDispatchContext,
): Promise<unknown> {
  if (!isHubMethod(method)) {
    throw new Error(`unknown hub method: ${method}`);
  }
  const hubMethod = method as HubMethod;
  const def = getHubMethodDef(hubMethod);
  const parsedInput = def.input.parse(payload);

  const featureHandler = getFeatureRpcHandler(hubMethod as RpcMethod);
  if (featureHandler) {
    return featureHandler(deps, parsedInput, ctx);
  }

  throw new Error(`no handler registered for hub method: ${method}`);
}
