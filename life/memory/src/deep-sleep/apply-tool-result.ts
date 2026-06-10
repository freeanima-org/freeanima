import { applyChangeLog, type DeepSleepChangeLog } from "./types.ts";

function parseToolJson(content: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(content);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    if ("error" in parsed && parsed.error) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function asId(value: unknown): string {
  return String(value ?? "").trim();
}

/** 根据深睡工具 tool_result 更新内存变更日志 */
export function applyDeepSleepToolResult(
  log: DeepSleepChangeLog,
  toolName: string,
  content: string,
): void {
  const parsed = parseToolJson(content);
  if (!parsed) return;

  switch (toolName) {
    case "memory_semantic_create": {
      const id = asId(parsed.semantic_memory_id ?? parsed.id);
      if (!id) return;
      applyChangeLog(log, "added", id, "新建语义记忆");
      break;
    }
    case "memory_semantic_update": {
      const id = asId(parsed.semantic_memory_id ?? parsed.id);
      if (!id) return;
      applyChangeLog(log, "modified", id, "更新语义记忆");
      break;
    }
    case "memory_semantic_deprecate": {
      const id = asId(parsed.semantic_memory_id ?? parsed.id);
      if (!id) return;
      applyChangeLog(log, "deprecated", id, "废弃语义记忆");
      break;
    }
    case "memory_semantic_merge": {
      const newId = asId(parsed.id);
      if (newId) applyChangeLog(log, "added", newId, "合并后新记忆");
      const deprecated = parsed.deprecated_ids;
      if (Array.isArray(deprecated)) {
        for (const raw of deprecated) {
          const id = asId(raw);
          if (id) applyChangeLog(log, "deprecated", id, `已合并到 ${newId || "?"}`);
        }
      }
      break;
    }
    default:
      break;
  }
}
