import { readFileSync } from "node:fs";
import { z } from "zod";

import type { SapRequestContext } from "@freeanima/shared/sap-contract";
import type { SapServerDeps } from "@freeanima/platform/sap/types";

import { ApiHandlerError } from "../../console/hub/console-api/handlers/errors.ts";
import { resolveAssetFilePath } from "../domain/client-config.ts";
import { addModelFromUpload } from "../domain/model-registry.ts";
import { importMotionUpload } from "../domain/motion-import.ts";
import { validateVrmUpload } from "../domain/models.ts";

const companionAssetGetInputSchema = z.object({
  kind: z.enum(["models", "motions"]),
  fileName: z.string().min(1),
});

function requireHttpRequest(ctx: SapRequestContext): Request {
  const httpRequest = (ctx as SapRequestContext & { httpRequest?: Request }).httpRequest;
  if (!httpRequest) {
    throw new Error("companion binary hub method requires HTTP request context");
  }
  return httpRequest;
}

export async function handleCompanionAssetGet(
  _deps: SapServerDeps,
  payload: unknown,
  _ctx: SapRequestContext,
): Promise<Response> {
  const input = companionAssetGetInputSchema.parse(payload);
  const path = resolveAssetFilePath(input.kind, input.fileName);
  if (!path) {
    throw new ApiHandlerError(404, "资产不存在", { code: "NOT_FOUND" });
  }
  const bytes = readFileSync(path);
  const contentType = input.kind === "models" ? "model/vrm" : "application/octet-stream";
  return new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600",
    },
  });
}

export async function handleCompanionModelUpload(
  _deps: SapServerDeps,
  _payload: unknown,
  ctx: SapRequestContext,
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
  _deps: SapServerDeps,
  _payload: unknown,
  ctx: SapRequestContext,
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
  if (!lower.endsWith(".zip") && !lower.endsWith(".vrma") && !lower.endsWith(".fbx")) {
    throw new ApiHandlerError(400, "仅支持 .vrma、.fbx 或 .zip");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const result = await importMotionUpload(file.name, bytes);
  return { ok: true as const, ...result };
}
