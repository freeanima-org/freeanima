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

/** Update in-memory change log from deep sleep tool_result */
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
      applyChangeLog(log, "added", id, "new semantic memory");
      break;
    }
    case "memory_semantic_update": {
      const id = asId(parsed.semantic_memory_id ?? parsed.id);
      if (!id) return;
      applyChangeLog(log, "modified", id, "updated semantic memory");
      break;
    }
    case "memory_semantic_deprecate": {
      const id = asId(parsed.semantic_memory_id ?? parsed.id);
      if (!id) return;
      applyChangeLog(log, "deprecated", id, "deprecated semantic memory");
      break;
    }
    case "memory_semantic_merge": {
      const newId = asId(parsed.id);
      if (newId) applyChangeLog(log, "added", newId, "merged new memory");
      const deprecated = parsed.deprecated_ids;
      if (Array.isArray(deprecated)) {
        for (const raw of deprecated) {
          const id = asId(raw);
          if (id) applyChangeLog(log, "deprecated", id, `merged into ${newId || "?"}`);
        }
      }
      break;
    }
    default:
      break;
  }
}
