/** Chat / Coding 共用的附件草稿与上传助手（无 React 壳依赖） */

import { getTypedHabitatClient } from "@freeanima/client/portal-sdk/habitat-typed-client";
import { parseHabitatRestResponse } from "@freeanima/shared/habitat-rpc";

export const CHAT_ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024;

export type ChatAttachmentMeta = {
  filename: string;
  mime_type: string;
  size: number;
};

export type ChatAttachmentDraft = {
  localId: string;
  file: File;
  filename: string;
  mime_type: string;
  size: number;
  previewUrl: string | null;
};

function newLocalId(): string {
  return `att-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function filesFromClipboard(e: ClipboardEvent): File[] {
  const out: File[] = [];
  const clipboardData = e.clipboardData;
  if (!clipboardData) return out;
  if (clipboardData.files?.length) {
    for (const file of Array.from(clipboardData.files)) {
      out.push(file);
    }
  }
  if (out.length === 0 && clipboardData.items?.length) {
    for (const item of Array.from(clipboardData.items)) {
      if (item.kind !== "file") continue;
      const file = item.getAsFile();
      if (file) out.push(file);
    }
  }
  return out;
}

export function createAttachmentDraft(file: File): ChatAttachmentDraft {
  const mime = (file.type || "application/octet-stream").trim() || "application/octet-stream";
  const previewUrl = mime.startsWith("image/") ? URL.createObjectURL(file) : null;
  return {
    localId: newLocalId(),
    file,
    filename: (file.name || "attachment").trim() || "attachment",
    mime_type: mime,
    size: file.size,
    previewUrl,
  };
}

export function revokeAttachmentDraft(draft: ChatAttachmentDraft): void {
  if (draft.previewUrl) URL.revokeObjectURL(draft.previewUrl);
}

export function revokeAttachmentDrafts(drafts: readonly ChatAttachmentDraft[]): void {
  for (const d of drafts) revokeAttachmentDraft(d);
}

function habitat() {
  return getTypedHabitatClient();
}

export async function uploadChatAttachment(file: File): Promise<{
  temp_id: string;
  filename: string;
  content_type: string;
  size: number;
}> {
  const form = new FormData();
  form.append("file", file, file.name);
  const res = await habitat().callRaw("chat.attachment.upload", {}, { body: form });
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- RPC/加载器响应边界
  const body = (await parseHabitatRestResponse(res)) as {
    temp_id: string;
    filename: string;
    content_type: string;
    size: number;
  };
  return body;
}

export async function uploadChatAttachmentDrafts(drafts: readonly ChatAttachmentDraft[]): Promise<{
  tempIds: string[];
  attachments: ChatAttachmentMeta[];
}> {
  const tempIds: string[] = [];
  const attachments: ChatAttachmentMeta[] = [];
  for (const d of drafts) {
    if (d.size > CHAT_ATTACHMENT_MAX_BYTES) {
      throw new Error(
        `附件过大：${d.filename}（最大 ${CHAT_ATTACHMENT_MAX_BYTES / (1024 * 1024)} MiB）`,
      );
    }
    const uploaded = await uploadChatAttachment(d.file);
    tempIds.push(uploaded.temp_id);
    attachments.push({
      filename: uploaded.filename,
      mime_type: uploaded.content_type,
      size: uploaded.size,
    });
  }
  return { tempIds, attachments };
}
