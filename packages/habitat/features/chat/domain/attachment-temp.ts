import { mkdirSync, readFileSync, unlinkSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { randomPublicId } from "@freeanima/shared/util";

import { PATHS } from "@freeanima/habitat/core/config/paths.ts";
import type { MessageAttachmentMeta } from "@freeanima/shared/pg-shapes/jsonb/message-payload.ts";

/** 单附件上限（对齐 OpenCode / 邮件量级） */
export const CHAT_ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024;

/** 未消费 temp 的 TTL */
export const CHAT_ATTACHMENT_TTL_MS = 60 * 60 * 1000;

export type ChatAttachmentTempRecord = MessageAttachmentMeta & {
  temp_id: string;
  path: string;
  created_at_ms: number;
};

function ensureDir(): string {
  const dir = PATHS.chatAttachmentsTmpDir;
  mkdirSync(dir, { recursive: true });
  return dir;
}

function metaPath(tempId: string): string {
  return join(ensureDir(), `${tempId}.json`);
}

function bytesPath(tempId: string): string {
  return join(ensureDir(), `${tempId}.bin`);
}

export function putChatAttachmentTemp(input: {
  filename: string;
  mime_type: string;
  bytes: Uint8Array;
}): ChatAttachmentTempRecord {
  if (input.bytes.byteLength > CHAT_ATTACHMENT_MAX_BYTES) {
    throw new Error(`附件过大：最大 ${CHAT_ATTACHMENT_MAX_BYTES / (1024 * 1024)} MiB`);
  }
  const temp_id = randomPublicId();
  const created_at_ms = Date.now();
  const path = bytesPath(temp_id);
  writeFileSync(path, input.bytes);
  const record: ChatAttachmentTempRecord = {
    temp_id,
    filename: input.filename,
    mime_type: input.mime_type,
    size: input.bytes.byteLength,
    path,
    created_at_ms,
  };
  writeFileSync(metaPath(temp_id), JSON.stringify(record), "utf8");
  return record;
}

export function getChatAttachmentTemp(tempId: string): ChatAttachmentTempRecord | null {
  try {
    const raw = readFileSync(metaPath(tempId), "utf8");
    const parsed = JSON.parse(raw) as ChatAttachmentTempRecord;
    if (!parsed?.temp_id || !parsed.path) return null;
    if (Date.now() - parsed.created_at_ms > CHAT_ATTACHMENT_TTL_MS) {
      deleteChatAttachmentTemp(tempId);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function readChatAttachmentTempBytes(tempId: string): Uint8Array | null {
  const meta = getChatAttachmentTemp(tempId);
  if (!meta) return null;
  try {
    return new Uint8Array(readFileSync(meta.path));
  } catch {
    return null;
  }
}

export function deleteChatAttachmentTemp(tempId: string): void {
  try {
    unlinkSync(metaPath(tempId));
  } catch {
    /* ignore */
  }
  try {
    unlinkSync(bytesPath(tempId));
  } catch {
    /* ignore */
  }
}

export function deleteChatAttachmentTemps(tempIds: readonly string[]): void {
  for (const id of tempIds) deleteChatAttachmentTemp(id);
}

/** 启动或周期清扫过期 temp */
export function sweepExpiredChatAttachmentTemps(nowMs = Date.now()): number {
  let removed = 0;
  let dir: string;
  try {
    dir = ensureDir();
  } catch {
    return 0;
  }
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return 0;
  }
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    const tempId = name.slice(0, -".json".length);
    try {
      const st = statSync(join(dir, name));
      if (nowMs - st.mtimeMs > CHAT_ATTACHMENT_TTL_MS) {
        deleteChatAttachmentTemp(tempId);
        removed += 1;
      }
    } catch {
      /* ignore */
    }
  }
  return removed;
}

export function resolveAttachmentMetasFromTemps(
  tempIds: readonly string[],
): MessageAttachmentMeta[] {
  const out: MessageAttachmentMeta[] = [];
  for (const id of tempIds) {
    const rec = getChatAttachmentTemp(id);
    if (!rec) throw new Error(`附件临时文件不存在或已过期：${id}`);
    out.push({
      filename: rec.filename,
      mime_type: rec.mime_type,
      size: rec.size,
    });
  }
  return out;
}
