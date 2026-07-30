import { entities } from "@freeanima/host/core/db/schema";
import {
  SUBAGENT_COMPONENT,
  asSubagent,
  isValidSubagentSlug,
} from "@freeanima/host/core/db/schema/entity";
import { getDb } from "@freeanima/host/core/db/pg/client";
import {
  createEntity,
  deleteEntity,
  getEntity,
  listEntities,
  updateEntity,
} from "@freeanima/host/core/db/pg/entity";
import { omitUndefined } from "@freeanima/host/core/util";
import { and, eq, ne, sql } from "drizzle-orm";

import type { SubagentCreateInput, SubagentRow, SubagentUpdateInput } from "./types.ts";

function toRow(
  parsed: NonNullable<ReturnType<typeof asSubagent>>,
  meta: { created_at: Date; updated_at: Date },
): SubagentRow {
  return {
    id: parsed.id,
    world_id: parsed.world_id,
    title: parsed.title,
    summary: parsed.summary,
    content: parsed.content,
    slug: parsed.slug,
    skills: parsed.skills,
    max_turns: parsed.max_turns,
    allowed_tools: parsed.allowed_tools,
    denied_tools: parsed.denied_tools,
    prompt_includes: parsed.prompt_includes ?? [],
    created_at: meta.created_at.toISOString(),
    updated_at: meta.updated_at.toISOString(),
  };
}

async function assertSlugUnique(worldId: number, slug: string, excludeId?: number): Promise<void> {
  const db = getDb();
  const conditions = [
    eq(entities.world_id, worldId),
    eq(entities.primary_component, SUBAGENT_COMPONENT),
    sql`${entities.body}->>'slug' = ${slug}`,
  ];
  if (excludeId != null) {
    conditions.push(ne(entities.id, excludeId));
  }
  const [existing] = await db
    .select({ id: entities.id })
    .from(entities)
    .where(and(...conditions))
    .limit(1);
  if (existing) {
    throw new Error(`subagent slug already exists: ${slug}`);
  }
}

export async function listSubagents(worldId: number): Promise<SubagentRow[]> {
  const rows = await listEntities({
    world_id: worldId,
    primary_component: SUBAGENT_COMPONENT,
    limit: 500,
  });
  const out: SubagentRow[] = [];
  for (const row of rows) {
    const parsed = asSubagent(row);
    if (parsed) out.push(toRow(parsed, { created_at: row.created_at, updated_at: row.updated_at }));
  }
  return out.toSorted((a, b) => a.slug.localeCompare(b.slug));
}

export async function getSubagent(id: number): Promise<SubagentRow | null> {
  const row = await getEntity(id);
  if (!row) return null;
  const parsed = asSubagent(row);
  return parsed ? toRow(parsed, { created_at: row.created_at, updated_at: row.updated_at }) : null;
}

export async function getSubagentBySlug(
  worldId: number,
  slug: string,
): Promise<SubagentRow | null> {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return null;
  const db = getDb();
  const [hit] = await db
    .select({ id: entities.id })
    .from(entities)
    .where(
      and(
        eq(entities.world_id, worldId),
        eq(entities.primary_component, SUBAGENT_COMPONENT),
        sql`${entities.body}->>'slug' = ${normalized}`,
      ),
    )
    .limit(1);
  if (!hit) return null;
  return getSubagent(hit.id);
}

export async function createSubagent(
  worldId: number,
  input: SubagentCreateInput,
): Promise<SubagentRow> {
  const slug = input.slug.trim().toLowerCase();
  if (!isValidSubagentSlug(slug)) {
    throw new Error(`invalid subagent slug: ${input.slug}`);
  }
  await assertSlugUnique(worldId, slug);
  const title = input.title.trim() || slug;
  const created = await createEntity({
    type: "content",
    world_id: worldId,
    primary_component: SUBAGENT_COMPONENT,
    components: [SUBAGENT_COMPONENT],
    title,
    summary: input.summary?.trim() ?? "",
    content: input.content ?? "",
    body: {
      slug,
      skills: input.skills ?? [],
      max_turns: input.max_turns ?? null,
      allowed_tools: input.allowed_tools ?? [],
      denied_tools: input.denied_tools ?? [],
      prompt_includes: input.prompt_includes ?? [],
    },
  });
  const parsed = asSubagent(created);
  if (!parsed) throw new Error("failed to create subagent");
  return toRow(parsed, { created_at: created.created_at, updated_at: created.updated_at });
}

export async function updateSubagent(
  worldId: number,
  input: SubagentUpdateInput,
): Promise<SubagentRow> {
  const existing = await getSubagent(input.id);
  if (!existing || existing.world_id !== worldId) {
    throw new Error(`subagent not found: ${input.id}`);
  }
  let slug = existing.slug;
  if (input.slug != null) {
    slug = input.slug.trim().toLowerCase();
    if (!isValidSubagentSlug(slug)) {
      throw new Error(`invalid subagent slug: ${input.slug}`);
    }
    if (slug !== existing.slug) {
      await assertSlugUnique(worldId, slug, input.id);
    }
  }
  const body = {
    slug,
    skills: input.skills ?? existing.skills,
    max_turns: input.max_turns !== undefined ? input.max_turns : existing.max_turns,
    allowed_tools: input.allowed_tools ?? existing.allowed_tools,
    denied_tools: input.denied_tools ?? existing.denied_tools,
    prompt_includes: input.prompt_includes ?? existing.prompt_includes,
  };
  const updated = await updateEntity(
    omitUndefined({
      id: input.id,
      title: input.title?.trim(),
      summary: input.summary,
      content: input.content,
      body,
    }),
  );
  if (!updated) throw new Error(`subagent not found: ${input.id}`);
  const parsed = asSubagent(updated);
  if (!parsed) throw new Error("failed to update subagent");
  return toRow(parsed, { created_at: updated.created_at, updated_at: updated.updated_at });
}

export async function deleteSubagent(worldId: number, id: number): Promise<void> {
  const existing = await getSubagent(id);
  if (!existing || existing.world_id !== worldId) {
    throw new Error(`subagent not found: ${id}`);
  }
  await deleteEntity(id);
}
