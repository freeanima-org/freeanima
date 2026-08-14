import type { RemoteToolsRequestContext } from "@freeanima/shared/rpc-contract";

import { ApiHandlerError } from "../../habitat/habitat/habitat-api/handlers/errors.ts";
import { CHAT_ATTACHMENT_MAX_BYTES, putChatAttachmentTemp } from "../domain/attachment-temp.ts";

function requireHttpRequest(ctx: RemoteToolsRequestContext): Request {
  const httpRequest = (ctx as RemoteToolsRequestContext & { httpRequest?: Request }).httpRequest;
  if (!httpRequest) {
    throw new Error("chat binary habitat method requires HTTP request context");
  }
  return httpRequest;
}

export async function handleChatAttachmentUpload(
  _deps: unknown,
  _payload: unknown,
  ctx: RemoteToolsRequestContext,
): Promise<{
  temp_id: string;
  filename: string;
  content_type: string;
  size: number;
}> {
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

  if (file.size > CHAT_ATTACHMENT_MAX_BYTES) {
    throw new ApiHandlerError(
      400,
      `附件过大：最大 ${CHAT_ATTACHMENT_MAX_BYTES / (1024 * 1024)} MiB`,
      { code: "PAYLOAD_TOO_LARGE" },
    );
  }

  const filename = (file.name || "attachment").trim() || "attachment";
  const contentType =
    (file.type || "application/octet-stream").trim() || "application/octet-stream";
  const bytes = new Uint8Array(await file.arrayBuffer());

  try {
    const record = putChatAttachmentTemp({
      filename,
      mime_type: contentType,
      bytes,
    });
    return {
      temp_id: record.temp_id,
      filename: record.filename,
      content_type: record.mime_type,
      size: record.size,
    };
  } catch (e) {
    throw new ApiHandlerError(400, e instanceof Error ? e.message : String(e));
  }
}
