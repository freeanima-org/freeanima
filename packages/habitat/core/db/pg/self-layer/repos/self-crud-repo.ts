import { and, eq, isNull, sql } from "drizzle-orm";
import {
  SELF_BLOCK_COMPONENT,
  entities,
  selfBlockBodySchema,
  selfBlockKeySchema,
} from "@freeanima/habitat/core/db/schema";
import { resolvePrivateWorldId } from "@freeanima/habitat/core/config/world-context-pg.ts";
import { createEntity, updateEntity } from "@freeanima/habitat/core/db/pg/entity";
import { pgTextArray } from "@freeanima/habitat/core/db/pg/utils/pg-sql.ts";
import type {
  SelfBlockKey,
  SelfBlockRow,
  SelfBlockUpdateInput,
  SelfBlockUpsertInput,
} from "../types.ts";
import { SELF_BLOCK_KEYS } from "../types.ts";

import { getDb } from "../../client.ts";

function normalizeBlockKey(raw: string): SelfBlockKey {
  const parsed = selfBlockKeySchema.safeParse(raw.trim());
  if (!parsed.success) {
    throw new Error(`invalid self block key: ${raw}`);
  }
  return parsed.data;
}

async function resolveSelfWorldId(agentSubjectId: number): Promise<number> {
  if (!Number.isInteger(agentSubjectId) || agentSubjectId <= 0) {
    throw new Error("agent_subject_id is required for self-layer access");
  }
  return resolvePrivateWorldId(agentSubjectId);
}

const PLACEHOLDER_EPOCH = new Date(0);

function mapRow(row: {
  content: string | null;
  body: unknown;
  created_at: Date;
  updated_at: Date;
}): SelfBlockRow {
  const body = selfBlockBodySchema.parse(row.body ?? {});
  return {
    block_key: body.block_key,
    content: row.content ?? "",
    locked: body.locked,
    version: body.version,
    updated_by: body.updated_by ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function blockTitle(block_key: SelfBlockKey): string {
  return `self ${block_key}`;
}

type StoredSelfBlock = SelfBlockRow & { id: number };

async function getStoredSelfBlock(
  key: SelfBlockKey,
  agentSubjectId: number,
): Promise<StoredSelfBlock | null> {
  const worldId = await resolveSelfWorldId(agentSubjectId);
  const db = getDb();
  const rows = await db
    .select({
      id: entities.id,
      content: entities.content,
      body: entities.body,
      created_at: entities.created_at,
      updated_at: entities.updated_at,
    })
    .from(entities)
    .where(
      and(
        eq(entities.primary_component, SELF_BLOCK_COMPONENT),
        eq(entities.world_id, worldId),
        isNull(entities.deleted_at),
        sql`${entities.body}->>'block_key' = ${key}`,
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return { id: row.id, ...mapRow(row) };
}

/** Drop legacy keys (e.g. autobiography_summary) left after five-block migration */
export async function purgeOrphanSelfBlocks(agentSubjectId: number): Promise<number> {
  const worldId = await resolveSelfWorldId(agentSubjectId);
  const db = getDb();
  const deleted = await db
    .delete(entities)
    .where(
      and(
        eq(entities.primary_component, SELF_BLOCK_COMPONENT),
        eq(entities.world_id, worldId),
        sql`NOT (${entities.body}->>'block_key' = ANY(${pgTextArray([...SELF_BLOCK_KEYS])}))`,
      ),
    )
    .returning({ id: entities.id });
  return deleted.length;
}

export async function getSelfBlock(
  key: SelfBlockKey,
  agentSubjectId: number,
): Promise<SelfBlockRow | null> {
  const stored = await getStoredSelfBlock(key, agentSubjectId);
  if (!stored) return null;
  return {
    block_key: stored.block_key,
    content: stored.content,
    locked: stored.locked,
    version: stored.version,
    updated_by: stored.updated_by,
    created_at: stored.created_at,
    updated_at: stored.updated_at,
  };
}

export async function listSelfBlocks(agentSubjectId: number): Promise<SelfBlockRow[]> {
  const worldId = await resolveSelfWorldId(agentSubjectId);
  const db = getDb();
  const rows = await db
    .select({
      content: entities.content,
      body: entities.body,
      created_at: entities.created_at,
      updated_at: entities.updated_at,
    })
    .from(entities)
    .where(
      and(
        eq(entities.primary_component, SELF_BLOCK_COMPONENT),
        eq(entities.world_id, worldId),
        isNull(entities.deleted_at),
      ),
    );
  const byKey = new Map<SelfBlockKey, SelfBlockRow>();
  for (const row of rows) {
    const mapped = mapRow(row);
    byKey.set(mapped.block_key, mapped);
  }
  return SELF_BLOCK_KEYS.map((key) => {
    const existing = byKey.get(key);
    if (existing) return existing;
    return {
      block_key: key,
      content: "",
      locked: key === "existence_anchor",
      version: 0,
      updated_by: null,
      created_at: PLACEHOLDER_EPOCH,
      updated_at: PLACEHOLDER_EPOCH,
    };
  });
}

export async function upsertSelfBlock(
  input: SelfBlockUpsertInput,
  agentSubjectId: number,
): Promise<void> {
  const worldId = await resolveSelfWorldId(agentSubjectId);
  const block_key = normalizeBlockKey(input.block_key);
  const locked = input.locked ?? block_key === "existence_anchor";
  const existing = await getStoredSelfBlock(block_key, agentSubjectId);
  const version = existing ? existing.version + 1 : 1;
  const body = selfBlockBodySchema.parse({
    block_key,
    locked,
    version,
    updated_by: input.updated_by ?? null,
  }) as Record<string, unknown>;
  const title = blockTitle(block_key);
  const summary = input.content.slice(0, 200);
  if (existing) {
    await updateEntity({
      id: existing.id,
      title,
      content: input.content,
      summary,
      body,
    });
    return;
  }
  await createEntity({
    type: "content",
    world_id: worldId,
    components: [SELF_BLOCK_COMPONENT],
    primary_component: SELF_BLOCK_COMPONENT,
    title,
    summary,
    content: input.content,
    body,
  });
}

export async function updateSelfBlock(
  input: SelfBlockUpdateInput,
  agentSubjectId: number,
  opts?: { force?: boolean },
): Promise<void> {
  const block_key = normalizeBlockKey(input.block_key);
  const existing = await getStoredSelfBlock(block_key, agentSubjectId);
  if (!existing) {
    throw new Error(`self block not found: ${block_key}`);
  }
  if (existing.locked && !opts?.force) {
    throw new Error(`self block is locked: ${block_key}`);
  }

  const locked = input.locked !== undefined ? input.locked : existing.locked;
  const content = input.content !== undefined ? input.content : existing.content;
  const updated_by = input.updated_by !== undefined ? input.updated_by : existing.updated_by;
  const body = selfBlockBodySchema.parse({
    block_key,
    locked,
    version: existing.version + 1,
    updated_by,
  }) as Record<string, unknown>;

  await updateEntity({
    id: existing.id,
    title: blockTitle(block_key),
    content,
    summary: content.slice(0, 200),
    body,
  });
}
