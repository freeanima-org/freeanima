import { z } from "zod";
import type { RemoteToolsRequestContext } from "@freeanima/shared/rpc-contract";
import { resolvePrivateWorldId } from "@freeanima/habitat/core/config/world-context-pg";
import { createObjectFile } from "@freeanima/features/object-storage/domain";

import { attachHealthFiles, type HealthRow } from "../domain/index.ts";
import { ApiHandlerError } from "../../habitat/habitat/habitat-api/handlers/errors.ts";

export const HEALTH_ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024;

function requireHttpRequest(ctx: RemoteToolsRequestContext): Request {
  const httpRequest = (ctx as RemoteToolsRequestContext & { httpRequest?: Request }).httpRequest;
  if (!httpRequest) {
    throw new Error("health binary habitat method requires HTTP request context");
  }
  return httpRequest;
}

const attachInputSchema = z.object({
  subject_id: z.number().int().positive(),
  id: z.number().int().positive(),
});

export async function handleHealthAttachFiles(
  _deps: unknown,
  payload: unknown,
  ctx: RemoteToolsRequestContext,
): Promise<{ item: HealthRow }> {
  const input = attachInputSchema.parse(payload);
  const worldId = await resolvePrivateWorldId(input.subject_id);
  const request = requireHttpRequest(ctx);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new ApiHandlerError(400, "无效的 multipart 请求");
  }

  const entries = form.getAll("file");
  const files: Array<{ title: string; bytes: Uint8Array; mime_type?: string }> = [];

  for (const entry of entries) {
    if (!(entry instanceof File)) continue;
    if (entry.size > HEALTH_ATTACHMENT_MAX_BYTES) {
      throw new ApiHandlerError(
        400,
        `附件过大：最大 ${HEALTH_ATTACHMENT_MAX_BYTES / (1024 * 1024)} MiB`,
        { code: "PAYLOAD_TOO_LARGE" },
      );
    }
    const filename = (entry.name || "attachment").trim() || "attachment";
    const contentType =
      (entry.type || "application/octet-stream").trim() || "application/octet-stream";
    const bytes = new Uint8Array(await entry.arrayBuffer());
    files.push({ title: filename, bytes, mime_type: contentType });
  }

  if (files.length === 0) {
    throw new ApiHandlerError(400, "缺少 file 字段");
  }

  const item = await attachHealthFiles(worldId, input.id, files);
  if (!item) throw new ApiHandlerError(404, "健康记录不存在");
  return { item };
}

const uploadOnlyInputSchema = z.object({
  subject_id: z.number().int().positive(),
});

export async function handleHealthFileUpload(
  _deps: unknown,
  payload: unknown,
  ctx: RemoteToolsRequestContext,
): Promise<{
  object_file_id: number;
  filename: string;
  content_type: string;
  size: number;
}> {
  const input = uploadOnlyInputSchema.parse(payload);
  const worldId = await resolvePrivateWorldId(input.subject_id);
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

  if (file.size > HEALTH_ATTACHMENT_MAX_BYTES) {
    throw new ApiHandlerError(
      400,
      `附件过大：最大 ${HEALTH_ATTACHMENT_MAX_BYTES / (1024 * 1024)} MiB`,
      { code: "PAYLOAD_TOO_LARGE" },
    );
  }

  const filename = (file.name || "attachment").trim() || "attachment";
  const contentType =
    (file.type || "application/octet-stream").trim() || "application/octet-stream";
  const bytes = new Uint8Array(await file.arrayBuffer());

  const objectFile = await createObjectFile({
    world_id: worldId,
    title: filename,
    bytes,
    mime_type: contentType,
  });

  return {
    object_file_id: objectFile.id,
    filename: objectFile.title,
    content_type: objectFile.mime_type,
    size: objectFile.size,
  };
}
