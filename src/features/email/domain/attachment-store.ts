import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { homePath } from "@freeanima/host/core/config/paths";
import type { EmailMessageAttachmentMeta } from "@freeanima/host/core/db/schema/entity";

import type { ParsedEmailAttachment } from "./mime-parse.ts";

function emailAccountAttachmentsRoot(accountId: number): string {
  return homePath("email-attachments", String(accountId));
}

function emailAttachmentsRoot(accountId: number, messageId: number): string {
  return join(emailAccountAttachmentsRoot(accountId), String(messageId));
}

/** 删除某账户下本地附件目录（不存在则忽略）。 */
export async function removeEmailAccountAttachments(accountId: number): Promise<void> {
  await rm(emailAccountAttachmentsRoot(accountId), { recursive: true, force: true });
}

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

/** 将 MIME 附件写入 FREEANIMA_HOME/email-attachments/{account}/{message}/ 并返回元信息。 */
export async function persistEmailAttachments(
  accountId: number,
  messageId: number,
  attachments: ParsedEmailAttachment[],
): Promise<EmailMessageAttachmentMeta[]> {
  if (attachments.length === 0) return [];

  const dir = emailAttachmentsRoot(accountId, messageId);
  await mkdir(dir, { recursive: true });

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

    const path = join(dir, filename);
    await writeFile(path, att.content);
    out.push({
      file_id: attachmentFileId(messageId, index, filename),
      filename,
      content_type: att.content_type,
      size: att.size,
      path,
      ...(att.content_id ? { content_id: att.content_id } : {}),
    });
  }

  return out;
}
