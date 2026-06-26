import { and, count, eq, sql } from "drizzle-orm";
import { entities, entityTypeSchema } from "@freeanima/core/db/schema";
import {
  mergeComponentBody,
  mapEntityRow,
  primaryComponentSchema,
  validateEntityBody,
} from "@freeanima/core/db/schema/entity";
import type {
  EntityCreateInput,
  EntityListOpts,
  EntityRow,
  EntityUpdateInput,
} from "@freeanima/core/repos";
import { formatCstIso } from "@freeanima/core/util";

import { getDb } from "../../client.ts";

function mapRow(row: typeof entities.$inferSelect): EntityRow {
  return mapEntityRow(row);
}

function normalizeCreate(input: EntityCreateInput) {
  const type = entityTypeSchema.parse(input.type);
  const primary = primaryComponentSchema.parse(input.primary_component);
  const components = [...new Set([...input.components, primary])];
  const body = validateEntityBody(components, input.body);
  return { type, primary, components, body };
}

export async function createEntity(input: EntityCreateInput): Promise<EntityRow> {
  const { type, primary, components, body } = normalizeCreate(input);
  const now = formatCstIso(new Date());
  const db = getDb();
  const [row] = await db
    .insert(entities)
    .values({
      type,
      worldId: input.world_id,
      ownerId: input.owner_id ?? null,
      components,
      primaryComponent: primary,
      body,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!row) throw new Error("entity insert failed");
  return mapRow(row);
}

export async function getEntity(id: number): Promise<EntityRow | null> {
  const db = getDb();
  const [row] = await db.select().from(entities).where(eq(entities.id, id)).limit(1);
  return row ? mapRow(row) : null;
}

export async function updateEntity(input: EntityUpdateInput): Promise<EntityRow | null> {
  const existing = await getEntity(input.id);
  if (!existing) return null;

  const components = input.components ?? existing.components;
  const body = input.body
    ? mergeComponentBody(existing.body, input.body, components)
    : existing.body;

  validateEntityBody(components, body);

  const now = formatCstIso(new Date());
  const db = getDb();
  const [row] = await db
    .update(entities)
    .set({
      components,
      body,
      updatedAt: now,
    })
    .where(eq(entities.id, input.id))
    .returning();
  return row ? mapRow(row) : null;
}

export async function deleteEntity(id: number): Promise<boolean> {
  const db = getDb();
  const result = await db
    .delete(entities)
    .where(eq(entities.id, id))
    .returning({ id: entities.id });
  return result.length > 0;
}

function buildListConditions(opts?: Omit<EntityListOpts, "offset" | "limit">) {
  const conditions = [];
  if (opts?.world_id != null) {
    conditions.push(eq(entities.worldId, opts.world_id));
  }
  if (opts?.primary_component) {
    conditions.push(eq(entities.primaryComponent, opts.primary_component));
  }
  if (opts?.component) {
    conditions.push(sql`${entities.components} @> ARRAY[${opts.component}]::text[]`);
  }
  return conditions.length ? and(...conditions) : undefined;
}

export async function listEntities(opts?: EntityListOpts): Promise<EntityRow[]> {
  const db = getDb();
  const limit = Math.max(1, Math.min(500, opts?.limit ?? 100));
  const offset = Math.max(0, opts?.offset ?? 0);
  const where = buildListConditions(opts);
  const rows = await db
    .select()
    .from(entities)
    .where(where)
    .orderBy(entities.id)
    .limit(limit)
    .offset(offset);
  return rows.map(mapRow);
}

export async function countEntities(
  opts?: Omit<EntityListOpts, "offset" | "limit">,
): Promise<number> {
  const db = getDb();
  const where = buildListConditions(opts);
  const [row] = await db.select({ value: count() }).from(entities).where(where);
  return Number(row?.value ?? 0);
}

export async function countEntitiesByBodyListId(listId: number, worldId: number): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ value: count() })
    .from(entities)
    .where(
      and(
        eq(entities.worldId, worldId),
        eq(entities.primaryComponent, "task_item"),
        sql`${entities.body}->>'list_id' = ${String(listId)}`,
      ),
    );
  return Number(row?.value ?? 0);
}
