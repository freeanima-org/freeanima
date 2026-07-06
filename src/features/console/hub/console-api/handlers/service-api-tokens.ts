import {
  createServiceApiTokenWithSecret,
  getServiceApiTokenById,
  listServiceApiTokensBySubject,
  revokeServiceApiToken,
} from "@freeanima/core/db/pg/service-api-token";

import {
  authHasScope,
  parseServiceAuthFromRequest,
  type ServiceAuthContext,
} from "../auth-context.ts";
import { getSubjectEntity } from "./entities.ts";
import { ApiHandlerError } from "./errors.ts";

function requireFullAuth(request: Request): ServiceAuthContext {
  const auth = parseServiceAuthFromRequest(request);
  if (!auth || !authHasScope(auth, "full")) {
    throw new ApiHandlerError(403, "full scope required", { code: "scope_forbidden" });
  }
  return auth;
}

export async function listSubjectApiTokens(request: Request, subjectId: number) {
  requireFullAuth(request);
  await getSubjectEntity(subjectId);
  const items = await listServiceApiTokensBySubject(subjectId);
  return { items };
}

export async function createSubjectApiToken(
  request: Request,
  subjectId: number,
  input: { name: string },
) {
  requireFullAuth(request);
  await getSubjectEntity(subjectId);
  const name = input.name.trim();
  if (!name) {
    throw new ApiHandlerError(400, "name is required", { code: "token_name_required" });
  }
  const result = await createServiceApiTokenWithSecret({
    subject_id: subjectId,
    name,
  });
  return { token: result.token, plaintext: result.plaintext };
}

export async function revokeSubjectApiToken(request: Request, tokenId: number) {
  requireFullAuth(request);
  const row = await getServiceApiTokenById(tokenId);
  if (!row) {
    throw new ApiHandlerError(404, "token not found", { code: "token_not_found" });
  }
  const ok = await revokeServiceApiToken(tokenId);
  if (!ok) {
    throw new ApiHandlerError(404, "token not found", { code: "token_not_found" });
  }
  return { ok: true as const };
}
