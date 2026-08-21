import type { ContentBlockType, LimbicKind } from "@freeanima/habitat/core/db/schema/entity";
import {
  contentBlockTypeSchema,
  DREAM_COMPONENT,
  LIMBIC_COMPONENT,
  limbicKindSchema,
  NARRATIVE_COMPONENT,
  SEMANTIC_REF_COMPONENT,
} from "@freeanima/habitat/core/db/schema/entity";

import { coerceString } from "@freeanima/shared/coerce-string";
import { assertNarrow } from "@freeanima/shared/assert-narrow.ts";
import { asRecord } from "@freeanima/shared/util";

import type {
  ContentBlockLimbicInput,
  ContentBlockNarrativeInput,
  ContentBlockRow,
  ContentBlockSearchOrderBy,
  ContentBlockSemanticRefInput,
} from "./types.ts";

export const CONTENT_BLOCK_TYPES = contentBlockTypeSchema.options;

export const LIMBIC_KINDS = limbicKindSchema.options;

export const CONTENT_BLOCK_SEARCH_ORDER_BY = [
  "created_desc",
  "created_asc",
  "intensity_desc",
  "intensity_asc",
  "valence_desc",
  "valence_asc",
] as const satisfies readonly ContentBlockSearchOrderBy[];

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
      "Optional world override; otherwise subject_id or conversation subject selects the private world",
  },
  subject_id: {
    type: "integer",
    description:
      "Owning subject entity id (required unless world_id or conversation tool context resolves world)",
  },
} as const;

export function parseBlockType(raw: unknown): ContentBlockType | null {
  if (raw == null || raw === "") return null;
  const parsed = contentBlockTypeSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function parseSemanticComponent(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  const tag = coerceString(raw);
  return (SEMANTIC_COMPONENT_TAGS as readonly string[]).includes(tag) ? tag : null;
}

export function parseLimbicKind(raw: unknown): LimbicKind | null {
  if (raw == null || raw === "") return null;
  const parsed = limbicKindSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function parseSearchOrderBy(raw: unknown): ContentBlockSearchOrderBy | null {
  if (raw == null || raw === "") return null;
  const value = coerceString(raw);
  return (CONTENT_BLOCK_SEARCH_ORDER_BY as readonly string[]).includes(value)
    ? assertNarrow<ContentBlockSearchOrderBy>(value)
    : null;
}

export function parseOptionalFloat(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value == null) return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

export function parseLimbic(raw: unknown): ContentBlockLimbicInput | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  const obj = asRecord(raw);
  if (!obj) return null;
  const valence = Number(obj.valence);
  const arousal = Number(obj.arousal);
  const intensity = Number(obj.intensity);
  if (![valence, arousal, intensity].every(Number.isFinite)) return null;
  const out: ContentBlockLimbicInput = { valence, arousal, intensity };
  if (obj.kind !== undefined) {
    const kind = parseLimbicKind(obj.kind);
    if (!kind) return null;
    out.kind = kind;
  }
  if (obj.conversation_id !== undefined) {
    out.conversation_id = coerceString(obj.conversation_id);
  }
  if (obj.source_segment !== undefined) {
    out.source_segment = obj.source_segment == null ? null : coerceString(obj.source_segment);
  }
  if (obj.semantic_memory_ids !== undefined) {
    if (!Array.isArray(obj.semantic_memory_ids)) return null;
    const ids: number[] = [];
    for (const id of obj.semantic_memory_ids) {
      const n = Number(id);
      if (!Number.isInteger(n) || n <= 0) return null;
      ids.push(n);
    }
    out.semantic_memory_ids = ids;
  }
  return out;
}

export function parseNarrative(raw: unknown): ContentBlockNarrativeInput | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  const obj = asRecord(raw);
  if (!obj) return null;
  const significance = obj.significance;
  if (
    significance != null &&
    significance !== "normal" &&
    significance !== "milestone" &&
    significance !== "turning_point"
  ) {
    return null;
  }
  const status = obj.status;
  if (status != null && status !== "active" && status !== "deprecated") {
    return null;
  }
  const out: ContentBlockNarrativeInput = {};
  if (significance != null) {
    out.significance = significance;
  }
  if (status != null) {
    out.status = status;
  }
  if (obj.period_start !== undefined) {
    out.period_start = obj.period_start == null ? null : coerceString(obj.period_start);
  }
  if (obj.period_end !== undefined) {
    out.period_end = obj.period_end == null ? null : coerceString(obj.period_end);
  }
  if (obj.source_facts !== undefined) {
    if (!Array.isArray(obj.source_facts)) return null;
    const ids: number[] = [];
    for (const id of obj.source_facts) {
      const n = Number(id);
      if (!Number.isInteger(n) || n <= 0) return null;
      ids.push(n);
    }
    out.source_facts = ids;
  }
  if (obj.source_conversations !== undefined) {
    if (!Array.isArray(obj.source_conversations)) return null;
    out.source_conversations = obj.source_conversations.map((v) => coerceString(v));
  }
  return out;
}

export function parseSemanticRef(raw: unknown): ContentBlockSemanticRefInput | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  const obj = asRecord(raw);
  if (!obj) return null;
  const id = Number(obj.entity_id);
  if (!Number.isInteger(id) || id <= 0) return null;
  return { entity_id: id };
}

/** 对齐旧 limbic search：intensity / valence 范围在内存 clamp */
export function clampContentBlockLimbicRange(
  rows: ContentBlockRow[],
  opts: {
    minIntensity?: number | null;
    maxIntensity?: number | null;
    minValence?: number | null;
    maxValence?: number | null;
  },
): ContentBlockRow[] {
  let out = rows;
  if (opts.minIntensity != null) {
    const minIntensity = opts.minIntensity;
    out = out.filter((r) => (r.limbic?.intensity ?? Number.NEGATIVE_INFINITY) >= minIntensity);
  }
  if (opts.maxIntensity != null) {
    const maxIntensity = opts.maxIntensity;
    out = out.filter((r) => (r.limbic?.intensity ?? Number.POSITIVE_INFINITY) <= maxIntensity);
  }
  if (opts.minValence != null) {
    const minValence = opts.minValence;
    out = out.filter((r) => r.limbic?.valence != null && r.limbic.valence >= minValence);
  }
  if (opts.maxValence != null) {
    const maxValence = opts.maxValence;
    out = out.filter((r) => r.limbic?.valence != null && r.limbic.valence <= maxValence);
  }
  return out;
}

export function applyContentBlockSearchOrder(
  rows: ContentBlockRow[],
  orderBy: ContentBlockSearchOrderBy | undefined,
): ContentBlockRow[] {
  const order = orderBy ?? "created_desc";
  switch (order) {
    case "intensity_desc":
      return [...rows].toSorted((a, b) => (b.limbic?.intensity ?? 0) - (a.limbic?.intensity ?? 0));
    case "intensity_asc":
      return [...rows].toSorted((a, b) => (a.limbic?.intensity ?? 0) - (b.limbic?.intensity ?? 0));
    case "valence_desc":
      return [...rows].toSorted((a, b) => (b.limbic?.valence ?? 0) - (a.limbic?.valence ?? 0));
    case "valence_asc":
      return [...rows].toSorted((a, b) => (a.limbic?.valence ?? 0) - (b.limbic?.valence ?? 0));
    case "created_asc":
      return [...rows].toSorted(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
    case "created_desc":
    default:
      return [...rows].toSorted(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
  }
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
