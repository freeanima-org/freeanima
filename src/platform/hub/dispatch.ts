import type { SapMethod, SapRequestContext } from "@freeanima/shared/sap-contract";
import { getHubMethodDef, isHubMethod, type HubMethod } from "@freeanima/shared/hub-contract";
import { getFeatureRpcHandler } from "../features/registry.ts";
import type { SapServerDeps } from "../sap/types.ts";

export type HubDispatchContext = SapRequestContext & {
  app_id: string;
  instance_id: string;
};

/** 统一 Hub method dispatch（WS / HTTP 适配器共用入口） */
export async function hubDispatch(
  deps: SapServerDeps,
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

  const featureHandler = getFeatureRpcHandler(hubMethod as SapMethod);
  if (featureHandler) {
    return featureHandler(deps, parsedInput, ctx);
  }

  throw new Error(`no handler registered for hub method: ${method}`);
}
