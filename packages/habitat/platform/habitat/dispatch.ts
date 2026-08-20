import type { RemoteToolsRequestContext } from "@freeanima/shared/rpc-contract";
import {
  getHabitatMethodDef,
  isHabitatMethod,
  type HabitatMethod,
} from "@freeanima/shared/habitat-contract";
import { getFeatureRpcHandler } from "../features/registry.ts";
import type { RemoteToolsServerDeps } from "@freeanima/habitat/capabilities/outpost/transport/types.ts";
import { runWithServiceApiAuth } from "@freeanima/habitat/core/db/pg/service-api-token/service-auth-als.ts";
import { assertTokenRpcAccess, TokenAuthorizationError } from "./token-rpc-access.ts";

export type HabitatDispatchContext = RemoteToolsRequestContext & {
  app_id: string;
  instance_id: string;
  /** HTTP REST 适配器注入；WS 无此字段 */
  httpRequest?: Request;
};

function accessFromMethodMeta(method: HabitatMethod): "read" | "write" {
  const def = getHabitatMethodDef(method);
  const verb = def.meta.http?.verb;
  if (verb === "GET") return "read";
  if (verb === "POST") return "write";
  return def.meta.defaultByProfile.habitat === "http" ? "read" : "write";
}

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

  assertTokenRpcAccess({
    method: hubMethod,
    authorization: ctx.auth.authorization,
    access: accessFromMethodMeta(hubMethod),
  });

  const parsedInput = def.input.parse(payload);
  const run = async () => {
    const featureHandler = getFeatureRpcHandler(hubMethod);
    if (featureHandler) {
      return featureHandler(deps, parsedInput, ctx);
    }
    throw new Error(`no handler registered for habitat method: ${method}`);
  };

  if (ctx.auth.token_id > 0) {
    return runWithServiceApiAuth(
      {
        token_id: ctx.auth.token_id,
        subject_id: ctx.auth.subject_id,
        subject_type: ctx.auth.subject_type,
        authorization: ctx.auth.authorization,
      },
      run,
    );
  }
  return run();
}

export { TokenAuthorizationError };
