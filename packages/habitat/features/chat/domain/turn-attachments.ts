import type {
  MessageAttachmentMeta,
  MessageContentMedia,
  StoredMessage,
} from "@freeanima/habitat/core/db/domain";
import {
  deleteChatAttachmentTemps,
  getChatAttachmentTemp,
  readChatAttachmentTempBytes,
  resolveAttachmentMetasFromTemps,
} from "@freeanima/features/chat/domain/attachment-temp.ts";

const TEXT_INLINE_MAX_BYTES = 64 * 1024;

function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function isImageMime(mime: string): boolean {
  return mime.startsWith("image/");
}

function isTextMime(mime: string): boolean {
  return (
    mime.startsWith("text/") ||
    mime === "application/json" ||
    mime === "application/xml" ||
    mime.endsWith("+json") ||
    mime.endsWith("+xml")
  );
}

export type ResolvedChatAttachments = {
  metas: MessageAttachmentMeta[];
  content_media: MessageContentMedia[];
  /** 拼进 user content 的文本摘录 / 说明 */
  content_suffix: string;
  has_images: boolean;
};

/** 从 temp id 解析本 turn 附件（校验存在）；不删文件。 */
export function resolveTurnAttachments(tempIds: readonly string[]): ResolvedChatAttachments {
  const metas = resolveAttachmentMetasFromTemps(tempIds);
  const content_media: MessageContentMedia[] = [];
  const notes: string[] = [];
  let has_images = false;

  for (let i = 0; i < tempIds.length; i++) {
    const tempId = tempIds[i];
    const meta = metas[i];
    if (tempId == null || meta == null) {
      throw new Error("附件临时元数据与 temp id 数量不一致");
    }
    const rec = getChatAttachmentTemp(tempId);
    const bytes = readChatAttachmentTempBytes(tempId);
    if (!rec || !bytes) {
      throw new Error(`附件临时文件不存在或已过期：${tempId}`);
    }

    if (isImageMime(meta.mime_type)) {
      has_images = true;
      content_media.push({
        type: "image",
        mime_type: meta.mime_type,
        data_base64: bytesToBase64(bytes),
      });
      notes.push(`[附件: ${meta.filename} @ ${rec.path}]`);
      continue;
    }

    if (isTextMime(meta.mime_type) && bytes.byteLength <= TEXT_INLINE_MAX_BYTES) {
      const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
      notes.push(`[附件 ${meta.filename}]\n${text}`);
      continue;
    }

    notes.push(
      `[附件: ${meta.filename}（${meta.mime_type}，${meta.size} 字节）；本 turn 未作为像素/正文注入]`,
    );
  }

  return {
    metas,
    content_media,
    content_suffix: notes.length > 0 ? `\n\n${notes.join("\n\n")}` : "",
    has_images,
  };
}

/** 把本 turn 的 content_media 挂到 runtime 中最后一条匹配的 user 消息上。 */
export function attachContentMediaToLastUser(
  messages: StoredMessage[],
  userText: string,
  content_media: MessageContentMedia[],
): StoredMessage[] {
  if (content_media.length === 0) return messages;
  const out = messages.slice();
  for (let i = out.length - 1; i >= 0; i--) {
    const msg = out[i];
    if (msg?.role !== "user") continue;
    if (userText && msg.content !== userText && !msg.content.startsWith(userText)) {
      // 允许 content 已拼 suffix
      if (!userText || !msg.content.includes(userText.slice(0, Math.min(32, userText.length)))) {
        continue;
      }
    }
    out[i] = { ...msg, content_media };
    return out;
  }
  return messages;
}

export function cleanupTurnAttachmentTemps(tempIds: readonly string[] | undefined): void {
  if (!tempIds?.length) return;
  deleteChatAttachmentTemps(tempIds);
}
