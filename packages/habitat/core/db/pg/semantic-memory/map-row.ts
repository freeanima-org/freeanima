import {
  SEMANTIC_MEMORY_COMPONENT,
  normalizeSemanticMemoryType,
  semanticMemoryLinkSchema,
  semanticMemoryProvenanceSchema,
  semanticMemoryStatusSchema,
  type SemanticMemoryBody,
} from "@freeanima/habitat/core/db/schema";
import type { EntityRow } from "@freeanima/habitat/core/db/schema/entity";
import type { SemanticMemoryRow } from "@freeanima/habitat/core/db/schema/rows";
import { coerceString } from "@freeanima/shared/coerce-string";
import { omitUndefined } from "@freeanima/habitat/core/util";

export function parseObservedAt(raw: unknown): Date | null {
  if (raw == null || raw === "") return null;
  if (raw instanceof Date) return raw;
  const d = new Date(coerceString(raw));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toObservedAtIso(raw: string | Date | null | undefined): string | null {
  if (raw == null || raw === "") return null;
  const d = raw instanceof Date ? raw : new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function parseBodySource(raw: unknown): SemanticMemoryRow["source"] {
  if (raw == null) return null;
  const parsed = semanticMemoryProvenanceSchema.safeParse(raw);
  if (!parsed.success) return null;
  return omitUndefined(parsed.data);
}

function parseBodyLinks(raw: unknown): NonNullable<SemanticMemoryRow["links"]> {
  if (!Array.isArray(raw)) return [];
  const out: NonNullable<SemanticMemoryRow["links"]> = [];
  for (const item of raw) {
    const parsed = semanticMemoryLinkSchema.safeParse(item);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

export function entityToSemanticMemoryRow(row: EntityRow): SemanticMemoryRow {
  const body = row.body as Partial<SemanticMemoryBody>;
  const memory_kind =
    typeof body.memory_kind === "string" ? normalizeSemanticMemoryType(body.memory_kind) : "world";
  const statusParsed = semanticMemoryStatusSchema.safeParse(body.status ?? "active");
  const status = statusParsed.success ? statusParsed.data : "active";
  const source_conversations = Array.isArray(body.source_conversations)
    ? body.source_conversations.map((s) => s.trim()).filter(Boolean)
    : [];
  return {
    id: row.id,
    type: memory_kind,
    pinned: row.pinned,
    content: row.content,
    source_conversations,
    source: parseBodySource(body.source) ?? null,
    links: parseBodyLinks(body.links),
    observed_at: parseObservedAt(body.observed_at),
    occurred_at: body.occurred_at ?? null,
    status,
    reference_count: row.reference_count,
    created_at: row.created_at,
    updated_at: row.updated_at,
    world_id: row.world_id,
    ...(typeof body.legacy_id === "string" ? { legacy_id: body.legacy_id } : {}),
  };
}

export function isSemanticMemoryEntity(row: EntityRow): boolean {
  return row.primary_component === SEMANTIC_MEMORY_COMPONENT;
}

export function parseSemanticMemoryId(raw: string | number): number | null {
  if (typeof raw === "number" && Number.isInteger(raw) && raw > 0) return raw;
  const n = Number(String(raw).trim());
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}
