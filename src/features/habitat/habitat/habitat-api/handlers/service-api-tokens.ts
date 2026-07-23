import {
  createServiceApiTokenWithSecret,
  getServiceApiTokenById,
  listServiceApiTokensBySubject,
  revokeServiceApiToken,
} from "@freeanima/core/db/pg/service-api-token";
import type { FeatureRpcHandler } from "@freeanima/platform/features";
import type { RemoteToolsRequestContext } from "@freeanima/shared/rpc-contract";

import { authHasScope, type ServiceAuthContext } from "../auth-context.ts";
import { getSubjectEntity } from "./entities.ts";
import { ApiHandlerError } from "./errors.ts";

function requireFullAuth(ctx: RemoteToolsRequestContext): ServiceAuthContext {
  const auth = ctx.auth;
  if (!auth || !authHasScope(auth, "full")) {
    throw new ApiHandlerError(403, "full scope required", { code: "scope_forbidden" });
  }
  return auth;
}

/** Habitat Habitat RPC：subject API token 管理 */
export const tokensHabitatHandlers: Record<string, FeatureRpcHandler> = {
  "tokens.listForSubject": async (_deps, payload, ctx) => {
    requireFullAuth(ctx);
    const { id } = payload as { id: number };
    await getSubjectEntity(id);
    const items = await listServiceApiTokensBySubject(id);
    return { items };
  },
  "tokens.createForSubject": async (_deps, payload, ctx) => {
    requireFullAuth(ctx);
    const { id, name } = payload as { id: number; name: string };
    await getSubjectEntity(id);
    const trimmed = name.trim();
    if (!trimmed) {
      throw new ApiHandlerError(400, "name is required", { code: "token_name_required" });
    }
    const result = await createServiceApiTokenWithSecret({
      subject_id: id,
      name: trimmed,
    });
    return { token: result.token, plaintext: result.plaintext };
  },
  "tokens.revoke": async (_deps, payload, ctx) => {
    requireFullAuth(ctx);
    const { id } = payload as { id: number };
    const row = await getServiceApiTokenById(id);
    if (!row) {
      throw new ApiHandlerError(404, "token not found", { code: "token_not_found" });
    }
    const ok = await revokeServiceApiToken(id);
    if (!ok) {
      throw new ApiHandlerError(404, "token not found", { code: "token_not_found" });
    }
    return { ok: true as const };
  },
};
