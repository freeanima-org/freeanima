import { registerTool } from "@freeanima/engine-tool";
import type { LimbicKind, LimbicMemoryCreateInput } from "@freeanima/engine-repos";

import { getLimbicMemoryStore } from "./limbic-port.ts";

const LIMBIC_KINDS = ["session_mood", "turning_point", "spike"] as const;

function jsonResult(data: Record<string, unknown>): string {
  return JSON.stringify(data);
}

function jsonError(message: string): string {
  return JSON.stringify({ error: message });
}

function parseStringArray(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v).trim()).filter(Boolean);
}

function parseOptionalFloat(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

export function registerLimbicMemoryTools(): void {
  registerTool({
    name: "create_limbic_memory",
    description:
      "记录边缘系统情感记忆（第一人称「我感到…」）。kind：session_mood（会话整体情绪）| turning_point（情感转折）| spike（强烈瞬间）。" +
      "克制使用：轻微情绪波动、intensity < 0.3 时不应调用；无明确情感信号时跳过。",
    parameters: {
      type: "object",
      properties: {
        session_id: { type: "string", description: "关联 session id" },
        kind: {
          type: "string",
          enum: [...LIMBIC_KINDS],
          description: "session_mood | turning_point | spike",
        },
        content: { type: "string", description: "第一人称情感描述，如「我感到…」" },
        valence: { type: "number", description: "效价 -1.0 到 1.0（负-正）" },
        arousal: { type: "number", description: "唤醒度 0.0 到 1.0" },
        intensity: { type: "number", description: "强度 0.0 到 1.0，默认 0.5；< 0.3 不应调用" },
        source_segment: {
          type: "string",
          description: "对话位置：early | mid | late 或具体片段描述",
        },
        semantic_memory_ids: {
          type: "array",
          items: { type: "string" },
          description: "关联 semantic_memory id（通常来自 Phase 1 产出）",
        },
      },
      required: ["session_id", "kind", "content"],
    },
    handler: async (args: Record<string, unknown>) => {
      const sessionId = String(args.session_id ?? "").trim();
      const content = String(args.content ?? "").trim();
      const kindRaw = String(args.kind ?? "").trim();

      if (!sessionId) return jsonError("session_id is required");
      if (!content) return jsonError("content is required");
      if (!LIMBIC_KINDS.includes(kindRaw as (typeof LIMBIC_KINDS)[number])) {
        return jsonError(`kind must be one of: ${LIMBIC_KINDS.join(", ")}`);
      }

      const intensity = args.intensity !== undefined ? Number(args.intensity) : 0.5;
      if (Number.isNaN(intensity) || intensity < 0 || intensity > 1) {
        return jsonError("intensity must be between 0 and 1");
      }
      if (intensity < 0.3) {
        return jsonError("intensity < 0.3：轻微情绪波动不应写入 limbic_memory");
      }

      const row: LimbicMemoryCreateInput = {
        session_id: sessionId,
        kind: kindRaw as LimbicKind,
        content,
        valence: parseOptionalFloat(args.valence),
        arousal: parseOptionalFloat(args.arousal),
        intensity,
        source_segment: args.source_segment !== undefined ? String(args.source_segment) : undefined,
        semantic_memory_ids: parseStringArray(args.semantic_memory_ids),
      };

      try {
        const id = await getLimbicMemoryStore().create(row);
        return jsonResult({ ok: true, id, kind: kindRaw, intensity });
      } catch (err) {
        return jsonError(err instanceof Error ? err.message : String(err));
      }
    },
  });
}
