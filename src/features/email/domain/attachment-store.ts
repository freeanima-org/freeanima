import { createHash } from "node:crypto";

import type { EmailMessageAttachmentMeta } from "@freeanima/host/core/db/schema/entity";
import {
  createObjectFile,
  deleteObjectFile,
  downloadObjectFileBytes,
} from "@freeanima/features/object-storage/domain";

import type { ParsedEmailAttachment } from "./mime-parse.ts";

function safeFilename(name: string, index: number): string {
  const base = name.replace(/[/\\<>:"|?*\x00-\x1f]/g, "_").trim() || `attachment-${index + 1}`;
  return base.length > 200 ? base.slice(0, 200) : base;
}

function attachmentFileId(messageId: number, index: number, filename: string): string {
  const hash = createHash("sha256")
    .update(`${messageId}:${index}:${filename}`)
    .digest("hex")
    .slice(0, 12);
  return `${messageId}-${index + 1}-${hash}`;
}

/** 将 MIME 附件写入对象存储并返回元信息（含 object_file_id）。 */
export async function persistEmailAttachments(
  worldId: number,
  messageId: number,
  attachments: ParsedEmailAttachment[],
): Promise<EmailMessageAttachmentMeta[]> {
  if (attachments.length === 0) return [];

  const out: EmailMessageAttachmentMeta[] = [];
  const usedNames = new Set<string>();

  for (const [index, att] of attachments.entries()) {
    let filename = safeFilename(att.filename, index);
    if (usedNames.has(filename)) {
      const dot = filename.lastIndexOf(".");
      const stem = dot > 0 ? filename.slice(0, dot) : filename;
      const ext = dot > 0 ? filename.slice(dot) : "";
      filename = `${stem}-${index + 1}${ext}`;
    }
    usedNames.add(filename);

    const objectFile = await createObjectFile({
      world_id: worldId,
      title: filename,
      bytes: new Uint8Array(att.content),
      mime_type: att.content_type,
    });

    out.push({
      file_id: attachmentFileId(messageId, index, filename),
      filename,
      content_type: att.content_type,
      size: att.size,
      object_file_id: objectFile.id,
      ...(att.content_id ? { content_id: att.content_id } : {}),
    });
  }

  return out;
}

export type LoadedOutboundAttachment = {
  object_file_id: number;
  filename: string;
  content_type: string;
  size: number;
  content: Buffer;
};

/** 按 object_file_id 加载出站附件字节（校验 world）；复用已有 object_file，不新建。 */
export async function loadOutboundAttachmentFiles(input: {
  worldId: number;
  objectFileIds: number[];
}): Promise<LoadedOutboundAttachment[]> {
  const ids = [...new Set(input.objectFileIds.filter((id) => id > 0))];
  if (ids.length === 0) return [];

  const out: LoadedOutboundAttachment[] = [];
  for (const [index, objectFileId] of ids.entries()) {
    const downloaded = await downloadObjectFileBytes(objectFileId);
    if (downloaded.file.world_id !== input.worldId) {
      throw new Error(`attachment object_file ${objectFileId} is not in the send world`);
    }
    const filename = downloaded.file.title.trim() || `attachment-${index + 1}`;
    out.push({
      object_file_id: downloaded.file.id,
      filename,
      content_type: downloaded.file.mime_type,
      size: downloaded.file.size,
      content: Buffer.from(downloaded.bytes),
    });
  }
  return out;
}

/** 出站附件 meta（发信入库后写入 email_message.attachments）。 */
export function outboundAttachmentMeta(
  messageId: number,
  files: LoadedOutboundAttachment[],
): EmailMessageAttachmentMeta[] {
  return files.map((file, index) => ({
    file_id: attachmentFileId(messageId, index, file.filename),
    filename: file.filename,
    content_type: file.content_type,
    size: file.size,
    object_file_id: file.object_file_id,
  }));
}

/** 软删邮件附件对应的 object_file（不删 SSOT 字节；purge 后 GC）。 */
export async function softDeleteEmailAttachmentObjectFiles(
  attachments: EmailMessageAttachmentMeta[] | undefined | null,
): Promise<void> {
  if (!attachments?.length) return;
  for (const att of attachments) {
    if (att.object_file_id > 0) {
      await deleteObjectFile(att.object_file_id);
    }
  }
}
