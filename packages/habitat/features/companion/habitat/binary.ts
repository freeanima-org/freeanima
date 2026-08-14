import type { RemoteToolsRequestContext } from "@freeanima/shared/rpc-contract";
import type { RemoteToolsServerDeps } from "@freeanima/habitat/capabilities/outpost/transport/types";

import { ApiHandlerError } from "../../habitat/habitat/habitat-api/handlers/errors.ts";
import { addModelFromUpload } from "../domain/model-registry.ts";
import { importMotionUpload } from "../domain/motion-import.ts";
import { validateVrmUpload } from "../domain/models.ts";

function requireHttpRequest(ctx: RemoteToolsRequestContext): Request {
  const httpRequest = (ctx as RemoteToolsRequestContext & { httpRequest?: Request }).httpRequest;
  if (!httpRequest) {
    throw new Error("companion binary habitat method requires HTTP request context");
  }
  return httpRequest;
}

export async function handleCompanionModelUpload(
  _deps: RemoteToolsServerDeps,
  _payload: unknown,
  ctx: RemoteToolsRequestContext,
): Promise<{ ok: true }> {
  const request = requireHttpRequest(ctx);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new ApiHandlerError(400, "无效的 multipart 请求");
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    throw new ApiHandlerError(400, "缺少 file 字段");
  }
  const validationError = validateVrmUpload(file);
  if (validationError) {
    throw new ApiHandlerError(400, validationError);
  }
  await addModelFromUpload(file);
  return { ok: true as const };
}

export async function handleCompanionMotionImport(
  _deps: RemoteToolsServerDeps,
  _payload: unknown,
  ctx: RemoteToolsRequestContext,
): Promise<Record<string, unknown>> {
  const request = requireHttpRequest(ctx);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new ApiHandlerError(400, "无效的 multipart 请求");
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    throw new ApiHandlerError(400, "缺少 file 字段");
  }
  const lower = file.name.toLowerCase();
  if (!lower.endsWith(".vrma")) {
    throw new ApiHandlerError(400, "仅支持 .vrma");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const result = await importMotionUpload(file.name, bytes);
  return { ok: true as const, ...result };
}
