import {
  createServiceApiTokenWithSecret,
  getServiceApiTokenById,
  listServiceApiTokensBySubject,
  revealServiceApiTokenPlaintext,
  revokeServiceApiToken,
  updateServiceApiTokenName,
} from "@freeanima/habitat/core/db/pg/service-api-token";
import {
  expandTokenPreset,
  FULL_TOKEN_AUTHORIZATION,
  parseServiceApiTokenAuthorization,
} from "@freeanima/shared/service-api-auth";
import type { FeatureRpcHandler } from "@freeanima/habitat/platform/features";
import type { RemoteToolsRequestContext } from "@freeanima/shared/rpc-contract";

import { authHasScope, type ServiceAuthContext } from "../auth-context.ts";
import { getSubjectEntity } from "./entities.ts";
import { ApiHandlerError } from "./errors.ts";

function requireFullAuth(ctx: RemoteToolsRequestContext): ServiceAuthContext {
  const auth = ctx.auth;
  if (!auth || !authHasScope(auth, "full")) {
    throw new ApiHandlerError(403, "full authorization required", { code: "scope_forbidden" });
  }
  return auth;
}

function resolveCreateAuthorization(input: {
  preset?: "full" | "app" | "extension" | "mcp";
  world_ids?: number[];
  authorization?: import("@freeanima/shared/service-api-auth").ServiceApiTokenAuthorization;
}) {
  if (input.authorization) {
    return parseServiceApiTokenAuthorization(input.authorization);
  }
  const preset = input.preset ?? "full";
  if (preset === "full") return FULL_TOKEN_AUTHORIZATION;
  return expandTokenPreset(
    preset,
    input.world_ids && input.world_ids.length > 0 ? { worldIds: input.world_ids } : undefined,
  );
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
    const { id, name, preset, world_ids, authorization } = payload as {
      id: number;
      name: string;
      preset?: "full" | "app" | "extension" | "mcp";
      world_ids?: number[];
      authorization?: import("@freeanima/shared/service-api-auth").ServiceApiTokenAuthorization;
    };
    await getSubjectEntity(id);
    const trimmed = name.trim();
    if (!trimmed) {
      throw new ApiHandlerError(400, "name is required", { code: "token_name_required" });
    }
    const result = await createServiceApiTokenWithSecret({
      subject_id: id,
      name: trimmed,
      authorization: resolveCreateAuthorization({
        ...(preset !== undefined ? { preset } : {}),
        ...(world_ids !== undefined ? { world_ids } : {}),
        ...(authorization !== undefined ? { authorization } : {}),
      }),
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
  "tokens.reveal": async (_deps, payload, ctx) => {
    requireFullAuth(ctx);
    const { id } = payload as { id: number };
    const row = await getServiceApiTokenById(id);
    if (!row) {
      throw new ApiHandlerError(404, "token not found", { code: "token_not_found" });
    }
    try {
      const plaintext = await revealServiceApiTokenPlaintext(id);
      return { plaintext };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (message.includes("not revealable")) {
        throw new ApiHandlerError(400, message, { code: "token_not_revealable" });
      }
      if (message.includes("revoked or expired")) {
        throw new ApiHandlerError(400, message, { code: "token_inactive" });
      }
      throw new ApiHandlerError(404, message, { code: "token_not_found" });
    }
  },
  "tokens.updateName": async (_deps, payload, ctx) => {
    requireFullAuth(ctx);
    const { id, name } = payload as { id: number; name: string };
    const trimmed = name.trim();
    if (!trimmed) {
      throw new ApiHandlerError(400, "name is required", { code: "token_name_required" });
    }
    try {
      const token = await updateServiceApiTokenName(id, trimmed);
      return { token };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (message.includes("name is required")) {
        throw new ApiHandlerError(400, message, { code: "token_name_required" });
      }
      throw new ApiHandlerError(404, message, { code: "token_not_found" });
    }
  },
};
