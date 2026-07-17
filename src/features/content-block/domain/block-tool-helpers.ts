import type { ContentBlockType } from "@freeanima/core/db/schema/entity";
import {
  contentBlockTypeSchema,
  DREAM_COMPONENT,
  LIMBIC_COMPONENT,
  NARRATIVE_COMPONENT,
  SEMANTIC_REF_COMPONENT,
} from "@freeanima/core/db/schema/entity";

import type {
  ContentBlockLimbicInput,
  ContentBlockNarrativeInput,
  ContentBlockRow,
  ContentBlockSemanticRefInput,
} from "./types.ts";

export const CONTENT_BLOCK_TYPES = contentBlockTypeSchema.options;

export const SEMANTIC_COMPONENT_TAGS = [
  LIMBIC_COMPONENT,
  NARRATIVE_COMPONENT,
  SEMANTIC_REF_COMPONENT,
  DREAM_COMPONENT,
] as const;

export function parseWorldId(raw: unknown): number | null {
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? Math.floor(id) : null;
}

export const WORLD_ID_TOOL_PROPERTY = {
  type: "integer",
  description: "Owning world id (see system prompt: user_world_id / agent_world_id)",
} as const;

export const WORLD_ID_OPTIONAL = {
  world_id: {
    ...WORLD_ID_TOOL_PROPERTY,
    description:
      "Optional world override; defaults to caller subject private world (MCP token subject or agent subject for LLM)",
  },
} as const;

export function parseBlockType(raw: unknown): ContentBlockType | null {
  if (raw == null || raw === "") return null;
  const parsed = contentBlockTypeSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function parseSemanticComponent(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  const tag = String(raw);
  return (SEMANTIC_COMPONENT_TAGS as readonly string[]).includes(tag) ? tag : null;
}

export function parseLimbic(raw: unknown): ContentBlockLimbicInput | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const valence = Number(obj.valence);
  const arousal = Number(obj.arousal);
  const intensity = Number(obj.intensity);
  if (![valence, arousal, intensity].every(Number.isFinite)) return null;
  return { valence, arousal, intensity };
}

export function parseNarrative(raw: unknown): ContentBlockNarrativeInput | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const significance = obj.significance;
  if (
    significance != null &&
    significance !== "normal" &&
    significance !== "milestone" &&
    significance !== "turning_point"
  ) {
    return null;
  }
  if (significance != null) {
    return {
      significance: significance as NonNullable<ContentBlockNarrativeInput["significance"]>,
    };
  }
  return {};
}

export function parseSemanticRef(raw: unknown): ContentBlockSemanticRefInput | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) return null;
  const id = String((raw as Record<string, unknown>).semantic_memory_id ?? "").trim();
  if (!id) return null;
  return { semantic_memory_id: id };
}

export function blockPayload(item: ContentBlockRow) {
  return {
    id: item.id,
    title: item.title,
    content: item.content,
    summary: item.summary,
    block_type: item.block_type,
    parent_id: item.parent_id,
    sort_order: item.sort_order,
    url: item.url,
    client_op_id: item.client_op_id,
    components: item.components,
    limbic: item.limbic,
    narrative: item.narrative,
    semantic_ref: item.semantic_ref,
    created_at: item.created_at,
    updated_at: item.updated_at,
  };
}
