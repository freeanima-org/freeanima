import { z } from "zod";

import type { RemoteToolsRequestContext } from "@freeanima/shared/rpc-contract";
import type { RemoteToolsServerDeps } from "@freeanima/host/capabilities/outpost/transport/types";
import {
  assertSubjectCanAccessWorld,
  isUserAgentPrivateWorldPassthrough,
  resolveWorldFromEntityId,
  ToolWorldAccessError,
} from "@freeanima/host/core/db/pg/entity";
import { ApiHandlerError } from "../../habitat/habitat/habitat-api/handlers/errors.ts";
import {
  downloadObjectFileBytes,
  getObjectFile,
  ObjectStorageNotConfiguredError,
} from "../domain/index.ts";
import { binaryResponseWithCache, notModifiedIfMatch } from "../domain/http-cache.ts";

export { isUserAgentPrivateWorldPassthrough };

function requireHttpRequest(ctx: RemoteToolsRequestContext): Request {
  const httpRequest = (ctx as RemoteToolsRequestContext & { httpRequest?: Request }).httpRequest;
  if (!httpRequest) {
    throw new Error("object_storage binary habitat method requires HTTP request context");
  }
  return httpRequest;
}

const fileGetInputSchema = z.object({
  id: z.number().int().positive(),
});

/**
 * HTTP REST 无 ToolContext ALS；勿用 resolveToolWorld（无 callerAuth 时会落到 agent_subject_id）。
 * 以请求 Bearer 的 subject_id 做 world ACL；user → agent 私有 world 直通。
 */
export async function assertHttpCallerCanReadObjectFile(
  ctx: RemoteToolsRequestContext,
  entityId: number,
): Promise<void> {
  const subjectId = ctx.auth?.subject_id ?? 0;
  if (subjectId <= 0) {
    throw new ApiHandlerError(403, "authentication required", { code: "FORBIDDEN" });
  }
  try {
    const worldId = await resolveWorldFromEntityId(entityId);
    if (isUserAgentPrivateWorldPassthrough(ctx.auth?.subject_type, worldId)) {
      return;
    }
    await assertSubjectCanAccessWorld(subjectId, worldId, { access: "read" });
  } catch (e) {
    if (e instanceof ApiHandlerError) throw e;
    const msg = e instanceof ToolWorldAccessError ? e.message : String(e);
    throw new ApiHandlerError(403, msg, { code: "FORBIDDEN" });
  }
}

export async function handleObjectStorageFileGet(
  _deps: RemoteToolsServerDeps,
  payload: unknown,
  ctx: RemoteToolsRequestContext,
): Promise<Response> {
  const input = fileGetInputSchema.parse(payload);
  const req = requireHttpRequest(ctx);
  await assertHttpCallerCanReadObjectFile(ctx, input.id);

  const file = await getObjectFile(input.id);
  if (!file) {
    throw new ApiHandlerError(404, "object_file not found", { code: "NOT_FOUND" });
  }

  // ETag=cid：命中则 304，不拉 S3 /tmp
  const early = notModifiedIfMatch(req, file.cid);
  if (early) return early;

  try {
    const { bytes } = await downloadObjectFileBytes(input.id);
    return binaryResponseWithCache({
      req,
      bytes,
      contentType: file.mime_type,
      cid: file.cid,
    });
  } catch (e) {
    if (e instanceof ObjectStorageNotConfiguredError) {
      throw new ApiHandlerError(503, e.message, { code: e.code });
    }
    const msg = e instanceof Error ? e.message : String(e);
    throw new ApiHandlerError(404, msg, { code: "NOT_FOUND" });
  }
}

export async function assertObjectFileReadable(id: number): Promise<void> {
  const file = await getObjectFile(id);
  if (!file) throw new ApiHandlerError(404, "object_file not found", { code: "NOT_FOUND" });
}
