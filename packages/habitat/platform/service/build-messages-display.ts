import type { MessageAttachmentMeta, StoredMessage } from "@freeanima/habitat/core/db/domain";
import { TOOL_CALL_TITLE_KEY } from "@freeanima/habitat/core/tool";
import type {
  DisplayItem,
  DisplayToolBlockItem,
} from "@freeanima/habitat/platform/schemas/display";
import type { DisplayAttachment } from "@freeanima/shared/rpc-contract/frames/display";
import { coerceString } from "@freeanima/shared/coerce-string";
import { omitUndefined } from "@freeanima/habitat/core/util";

function parseArgs(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function argsPreviewFromObject(argsObj: Record<string, unknown>): string {
  return Object.keys(argsObj)
    .filter((k) => k !== TOOL_CALL_TITLE_KEY)
    .slice(0, 4)
    .map((k) => `${k}=${coerceString(argsObj[k] ?? "").slice(0, 40)}`)
    .join(", ");
}

function mapAttachmentMeta(a: MessageAttachmentMeta): DisplayAttachment {
  return {
    filename: a.filename,
    mime_type: a.mime_type,
    size: a.size,
    ...(typeof a.object_file_id === "number" ? { object_file_id: a.object_file_id } : {}),
  };
}

function animaMarker(id: number): string {
  return `[[anima:${id}]]`;
}

/** 将 object_file id 写入正文 anima 标记（已存在则跳过） */
export function appendObjectFileAnimaMarkers(content: string, ids: number[]): string {
  const unique: number[] = [];
  const seen = new Set<number>();
  for (const id of ids) {
    if (!Number.isInteger(id) || id <= 0 || seen.has(id)) continue;
    seen.add(id);
    unique.push(id);
  }
  if (unique.length === 0) return content;
  const missing = unique.map(animaMarker).filter((m) => !content.includes(m));
  if (missing.length === 0) return content;
  const base = content.trimEnd();
  return base ? `${base}\n\n${missing.join("\n")}` : missing.join("\n");
}

/**
 * object_file 走正文 anima URI；无 object_file_id 的附件（如乐观 previewUrl）仍保留 attachments。
 */
export function foldObjectFileAttachmentsIntoContent(
  content: string,
  attachments: DisplayAttachment[] | undefined,
): { content: string; attachments?: DisplayAttachment[] } {
  if (!attachments?.length) return { content };
  const remaining: DisplayAttachment[] = [];
  const ids: number[] = [];
  for (const a of attachments) {
    if (typeof a.object_file_id === "number" && a.object_file_id > 0) {
      ids.push(a.object_file_id);
    } else {
      remaining.push(a);
    }
  }
  return omitUndefined({
    content: appendObjectFileAnimaMarkers(content, ids),
    attachments: remaining.length > 0 ? remaining : undefined,
  });
}

/** 从 image_generate tool 结果解析 object_file id */
export function parseImageGenerateObjectFileId(result: string | undefined): number | null {
  if (!result?.trim()) return null;
  try {
    const parsed = JSON.parse(result) as Record<string, unknown>;
    const id = parsed.object_file_id;
    if (typeof id !== "number" || !Number.isFinite(id) || id <= 0) return null;
    return id;
  } catch {
    return null;
  }
}

/** Project conversation message sequence to Habitat display list (with tool_block aggregation) */
export function buildMessagesDisplay(all: StoredMessage[]): DisplayItem[] {
  const display: DisplayItem[] = [];
  let pendingBlock: DisplayToolBlockItem | null = null;
  /** 本回合 image_generate 产出的 object_file id，写入下一条助手正文 anima URI */
  let pendingGeneratedFileIds: number[] = [];

  const flushPendingBlock = (): void => {
    if (pendingBlock) {
      display.push(pendingBlock);
      pendingBlock = null;
    }
  };

  const takeGeneratedFileIds = (): number[] => {
    if (pendingGeneratedFileIds.length === 0) return [];
    const out = pendingGeneratedFileIds;
    pendingGeneratedFileIds = [];
    return out;
  };

  const pushVisibleMessage = (
    role: "user" | "assistant",
    content: string,
    attachments: DisplayAttachment[] | undefined,
    extraIds: number[] = [],
  ): void => {
    const folded = foldObjectFileAttachmentsIntoContent(content, attachments);
    const withGenerated = appendObjectFileAnimaMarkers(folded.content, extraIds);
    display.push(
      omitUndefined({
        type: "message" as const,
        role,
        content: withGenerated,
        attachments: folded.attachments,
      }),
    );
  };

  for (const msg of all) {
    const role = msg.role;

    if ((role === "user" && msg.content) || (role === "user" && msg.attachments?.length)) {
      flushPendingBlock();
      pendingGeneratedFileIds = [];
      pushVisibleMessage(
        "user",
        msg.content ?? "",
        msg.attachments?.length ? msg.attachments.map(mapAttachmentMeta) : undefined,
      );
      continue;
    }

    if (role === "assistant" && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
      const calls = msg.tool_calls.map((tc) => {
        const fn = tc.function;
        const argsRaw = fn?.arguments ?? "{}";
        const argsObj = parseArgs(argsRaw);
        return {
          name: fn?.name ?? "?",
          argsPreview: argsPreviewFromObject(argsObj),
          tool_call_id: tc.id,
          status: "pending",
          args: argsObj,
        };
      });
      if (msg.content) {
        flushPendingBlock();
        pushVisibleMessage(
          "assistant",
          msg.content,
          msg.attachments?.length ? msg.attachments.map(mapAttachmentMeta) : undefined,
          takeGeneratedFileIds(),
        );
        pendingBlock = { type: "tool_block", calls };
      } else if (pendingBlock) {
        pendingBlock.calls.push(...calls);
      } else {
        pendingBlock = { type: "tool_block", calls };
      }
      continue;
    }

    if (role === "tool") {
      if (pendingBlock) {
        const call = pendingBlock.calls.find((c) => c.tool_call_id === msg.tool_call_id);
        if (call) {
          call.result = msg.content;
          const isError =
            msg.content.includes('"error"') ||
            msg.content.startsWith('{"error"') ||
            msg.content.startsWith("Error:");
          call.status = isError ? "error" : "done";
          if (!isError && call.name === "image_generate") {
            const id = parseImageGenerateObjectFileId(msg.content);
            if (id != null) pendingGeneratedFileIds.push(id);
          }
        }
      }
      continue;
    }

    if (role === "assistant" && (msg.content || msg.attachments?.length)) {
      flushPendingBlock();
      pushVisibleMessage(
        "assistant",
        msg.content ?? "",
        msg.attachments?.length ? msg.attachments.map(mapAttachmentMeta) : undefined,
        takeGeneratedFileIds(),
      );
    }
  }

  flushPendingBlock();
  // 若回合以 tool 结束、尚无助手正文，补一条仅含 anima 标记的助手气泡
  const leftoverIds = takeGeneratedFileIds();
  if (leftoverIds.length > 0) {
    pushVisibleMessage("assistant", "", undefined, leftoverIds);
  }
  return display;
}

export type PaginatedMessagesDisplay = {
  conversation_id: string;
  display: DisplayItem[];
  total: number;
  offset: number;
  limit: number | null;
};

export function paginateMessagesDisplay(
  conversationId: string,
  all: StoredMessage[],
  opts?: { offset?: number; limit?: number | null },
): PaginatedMessagesDisplay {
  const full = buildMessagesDisplay(all);
  const total = full.length;
  const offset = Math.max(0, opts?.offset ?? 0);
  const limit = opts?.limit;

  if (limit === undefined || limit == null) {
    return { conversation_id: conversationId, display: full, total, offset: 0, limit: null };
  }

  const safeLimit = Math.max(1, limit);
  return {
    conversation_id: conversationId,
    display: full.slice(offset, offset + safeLimit),
    total,
    offset,
    limit: safeLimit,
  };
}
