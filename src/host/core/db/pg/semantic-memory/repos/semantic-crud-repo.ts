import { and, desc, eq, sql as drizzleSql } from "drizzle-orm";
import {
  SEMANTIC_MEMORY_COMPONENT,
  entities,
  normalizeSemanticMemoryType,
  semanticMemoryStatusSchema,
} from "@freeanima/host/core/db/schema";
import { getResolvedWorldContext } from "@freeanima/host/core/config/world-context";
import type {
  SemanticMemoryCreateInput,
  SemanticMemoryUpdateInput,
} from "@freeanima/host/core/db/pg/semantic-memory/types";
import type { SemanticMemoryRow } from "@freeanima/host/core/db/schema/rows";
import type { EntityRow } from "@freeanima/host/core/db/schema/entity";
import { RESIDENT_PINNED_MAX } from "@freeanima/host/core/db/pg/semantic-memory/types";
import { logPgComponent } from "../../log.ts";

const log = logPgComponent("memory");

import {
  createEntity,
  deleteEntity,
  getEntity,
  updateEntity,
} from "../../entity/repos/entity-crud-repo.ts";
import { getDb } from "../../client.ts";
import {
  entityToSemanticMemoryRow,
  isSemanticMemoryEntity,
  parseSemanticMemoryId,
  toObservedAtIso,
} from "../map-row.ts";
import {
  buildSemanticSourceConversationsCondition,
  buildSemanticStatusCondition,
} from "./semantic-filters.ts";

function normalizeStatus(raw: string | undefined | null): string {
  const parsed = semanticMemoryStatusSchema.safeParse(String(raw ?? "active").trim());
  return parsed.success ? parsed.data : "active";
}

function normalizeSourceSessions(raw: string[] | undefined): string[] {
  if (!raw) return [];
  return raw.map((s) => s.trim()).filter(Boolean);
}

function resolveAgentWorldId(explicit?: number): number {
  if (explicit != null && explicit > 0) return explicit;
  return getResolvedWorldContext().agent_world_id;
}

const semanticSelect = {
  id: entities.id,
  type: entities.type,
  world_id: entities.world_id,
  components: entities.components,
  primary_component: entities.primary_component,
  title: entities.title,
  summary: entities.summary,
  content: entities.content,
  body: entities.body,
  pinned: entities.pinned,
  reference_count: entities.reference_count,
  created_at: entities.created_at,
  updated_at: entities.updated_at,
} as const;

type SemanticSelectRow = {
  id: number;
  type: string;
  world_id: number;
  components: string[];
  primary_component: string;
  title: string;
  summary: string;
  content: string;
  body: unknown;
  pinned: boolean;
  reference_count: number;
  created_at: Date;
  updated_at: Date;
};

function mapDbRow(row: SemanticSelectRow): SemanticMemoryRow {
  const entityRow: EntityRow = {
    id: row.id,
    type: row.type as EntityRow["type"],
    world_id: row.world_id,
    components: [...row.components],
    primary_component: row.primary_component,
    title: row.title ?? "",
    summary: row.summary ?? "",
    content: row.content ?? "",
    body: (row.body ?? {}) as Record<string, unknown>,
    pinned: row.pinned ?? false,
    reference_count: row.reference_count ?? 0,
    tag_ids: [],
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
  return entityToSemanticMemoryRow(entityRow);
}

export async function createSemanticMemory(row: SemanticMemoryCreateInput): Promise<number> {
  const content = row.content.trim();
  if (!content) throw new Error("content is required");

  const memory_kind = normalizeSemanticMemoryType(row.type);
  const pinned = row.pinned ?? false;
  const now = new Date();
  const created = row.created_at ?? now;
  const updated = row.updated_at ?? created;
  const source_conversations = normalizeSourceSessions(row.source_conversations);
  const observed_at = toObservedAtIso(row.observed_at ?? created);
  const occurred_at = row.occurred_at ?? null;
  const status = normalizeStatus(row.status);
  const world_id = resolveAgentWorldId(row.world_id);

  const entity = await createEntity({
    type: "content",
    world_id,
    components: [SEMANTIC_MEMORY_COMPONENT],
    primary_component: SEMANTIC_MEMORY_COMPONENT,
    content,
    body: {
      memory_kind,
      status,
      source_conversations,
      observed_at,
      occurred_at,
    },
    pinned,
    reference_count: 0,
    created_at: created instanceof Date ? created : new Date(created),
    updated_at: updated instanceof Date ? updated : new Date(updated),
  });

  return entity.id;
}

export async function getSemanticMemory(id: string | number): Promise<SemanticMemoryRow | null> {
  const entityId = parseSemanticMemoryId(id);
  if (entityId == null) return null;
  const row = await getEntity(entityId);
  if (!row || !isSemanticMemoryEntity(row)) return null;
  return entityToSemanticMemoryRow(row);
}

export async function updateSemanticMemory(row: SemanticMemoryUpdateInput): Promise<void> {
  const entityId = parseSemanticMemoryId(row.id);
  if (entityId == null) throw new Error(`invalid semantic memory id: ${row.id}`);

  const existing = await getEntity(entityId);
  if (!existing || !isSemanticMemoryEntity(existing)) {
    throw new Error(`semantic memory not found: ${row.id}`);
  }

  const bodyPatch: Record<string, unknown> = {};
  if (row.type !== undefined) bodyPatch.memory_kind = normalizeSemanticMemoryType(row.type);
  if (row.source_conversations !== undefined) {
    bodyPatch.source_conversations = normalizeSourceSessions(row.source_conversations);
  }
  if (row.observed_at !== undefined) bodyPatch.observed_at = toObservedAtIso(row.observed_at);
  if (row.occurred_at !== undefined) bodyPatch.occurred_at = row.occurred_at;
  if (row.status !== undefined) bodyPatch.status = normalizeStatus(row.status);

  await updateEntity({
    id: entityId,
    ...(row.content !== undefined ? { content: row.content.trim() } : {}),
    ...(row.pinned !== undefined ? { pinned: row.pinned } : {}),
    ...(Object.keys(bodyPatch).length > 0 ? { body: bodyPatch } : {}),
  });
}

export async function deprecateSemanticMemory(id: string | number): Promise<boolean> {
  const entityId = parseSemanticMemoryId(id);
  if (entityId == null) return false;
  const existing = await getEntity(entityId);
  if (!existing || !isSemanticMemoryEntity(existing)) return false;
  const updated = await updateEntity({
    id: entityId,
    pinned: false,
    body: { status: "deprecated" },
  });
  return updated != null;
}

export async function deleteSemanticMemory(id: string | number): Promise<boolean> {
  const entityId = parseSemanticMemoryId(id);
  if (entityId == null) return false;
  const existing = await getEntity(entityId);
  if (!existing || !isSemanticMemoryEntity(existing)) return false;
  return deleteEntity(entityId);
}

export async function countSemanticMemory(): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ n: drizzleSql<number>`count(*)::int` })
    .from(entities)
    .where(
      and(
        eq(entities.primary_component, SEMANTIC_MEMORY_COMPONENT),
        drizzleSql`${entities.body}->>'status' = 'active'`,
      ),
    );
  return Number(rows[0]?.n ?? 0);
}

export async function listResidentSemanticMemory(topN = 20): Promise<SemanticMemoryRow[]> {
  const limit = Math.max(1, Math.min(100, topN));
  const db = getDb();

  const pinnedRows = await db
    .select(semanticSelect)
    .from(entities)
    .where(
      and(
        eq(entities.primary_component, SEMANTIC_MEMORY_COMPONENT),
        drizzleSql`${entities.body}->>'status' = 'active'`,
        eq(entities.pinned, true),
      ),
    )
    .orderBy(desc(entities.updated_at))
    .limit(RESIDENT_PINNED_MAX + 1);

  if (pinnedRows.length > RESIDENT_PINNED_MAX) {
    const omitted = pinnedRows.slice(RESIDENT_PINNED_MAX);
    log.warn("resident pinned count exceeds max; truncating", {
      pinned_count: pinnedRows.length,
      pinned_max: RESIDENT_PINNED_MAX,
      omitted_ids: omitted.map((r) => r.id),
    });
  }

  const pinnedLimited = pinnedRows.slice(0, RESIDENT_PINNED_MAX).map(mapDbRow);
  const pinnedIds = new Set(pinnedLimited.map((r) => r.id));
  const remaining = Math.max(0, limit - pinnedLimited.length);

  let topReferenced = pinnedLimited;
  if (remaining > 0) {
    const candidates = await db
      .select(semanticSelect)
      .from(entities)
      .where(
        and(
          eq(entities.primary_component, SEMANTIC_MEMORY_COMPONENT),
          drizzleSql`${entities.body}->>'status' = 'active'`,
          eq(entities.pinned, false),
          drizzleSql`${entities.reference_count} > 0`,
        ),
      )
      .orderBy(desc(entities.reference_count), desc(entities.updated_at))
      .limit(remaining);
    topReferenced = [
      ...pinnedLimited,
      ...candidates.map(mapDbRow).filter((r) => !pinnedIds.has(r.id)),
    ];
  }

  return topReferenced;
}

export async function listAllSemanticMemory(): Promise<SemanticMemoryRow[]> {
  const db = getDb();
  const rows = await db
    .select(semanticSelect)
    .from(entities)
    .where(eq(entities.primary_component, SEMANTIC_MEMORY_COMPONENT))
    .orderBy(desc(entities.updated_at));
  return rows.map(mapDbRow);
}

export async function listActiveSemanticMemory(): Promise<SemanticMemoryRow[]> {
  const db = getDb();
  const rows = await db
    .select(semanticSelect)
    .from(entities)
    .where(
      and(
        eq(entities.primary_component, SEMANTIC_MEMORY_COMPONENT),
        drizzleSql`${entities.body}->>'status' = 'active'`,
      ),
    )
    .orderBy(desc(entities.updated_at));
  return rows.map(mapDbRow);
}

export async function listSemanticMemoryBySourceSessions(
  conversationIds: string[],
  opts?: { status?: "active" | "deprecated" | "all" },
): Promise<SemanticMemoryRow[]> {
  const ids = conversationIds.map((s) => s.trim()).filter(Boolean);
  if (ids.length === 0) return [];

  const status = opts?.status ?? "active";
  const sourceCond = buildSemanticSourceConversationsCondition(ids);
  if (!sourceCond) return [];

  const conditions = [eq(entities.primary_component, SEMANTIC_MEMORY_COMPONENT), sourceCond];
  const statusCond = buildSemanticStatusCondition(status);
  if (statusCond) conditions.push(statusCond);

  const db = getDb();
  const rows = await db
    .select(semanticSelect)
    .from(entities)
    .where(and(...conditions))
    .orderBy(desc(entities.updated_at));
  return rows.map(mapDbRow);
}

export async function findSemanticMemoryByContent(
  content: string,
): Promise<SemanticMemoryRow | null> {
  const trimmed = content.trim();
  if (!trimmed) return null;

  const db = getDb();
  const rows = await db
    .select(semanticSelect)
    .from(entities)
    .where(
      and(
        eq(entities.primary_component, SEMANTIC_MEMORY_COMPONENT),
        drizzleSql`${entities.body}->>'status' = 'active'`,
        drizzleSql`btrim(${entities.content}) = btrim(${trimmed})`,
      ),
    )
    .limit(1);
  const row = rows[0];
  return row ? mapDbRow(row) : null;
}
