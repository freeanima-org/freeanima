import { z } from "zod";
import type { RemoteToolsRequestContext } from "@freeanima/shared/rpc-contract";
import { resolveSubjectWorldId, type SubjectKind } from "@freeanima/host/core/config";
import { createObjectFile } from "@freeanima/features/object-storage/domain";

import { ApiHandlerError } from "../../habitat/habitat/habitat-api/handlers/errors.ts";

/** 单附件上传上限（与发信计划一致） */
export const EMAIL_ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024;

function requireHttpRequest(ctx: RemoteToolsRequestContext): Request {
  const httpRequest = (ctx as RemoteToolsRequestContext & { httpRequest?: Request }).httpRequest;
  if (!httpRequest) {
    throw new Error("email binary habitat method requires HTTP request context");
  }
  return httpRequest;
}

const uploadInputSchema = z.object({
  subject_kind: z.enum(["user", "agent"]),
});

export async function handleEmailAttachmentUpload(
  _deps: unknown,
  payload: unknown,
  ctx: RemoteToolsRequestContext,
): Promise<{
  object_file_id: number;
  filename: string;
  content_type: string;
  size: number;
}> {
  const input = uploadInputSchema.parse(payload);
  const worldId = resolveSubjectWorldId(input.subject_kind as SubjectKind);
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

  if (file.size > EMAIL_ATTACHMENT_MAX_BYTES) {
    throw new ApiHandlerError(
      400,
      `附件过大：最大 ${EMAIL_ATTACHMENT_MAX_BYTES / (1024 * 1024)} MiB`,
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
