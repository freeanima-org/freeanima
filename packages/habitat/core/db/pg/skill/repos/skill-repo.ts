import { and, eq, isNull } from "drizzle-orm";
import { entities } from "@freeanima/habitat/core/db/schema";
import {
  SKILL_COMPONENT,
  SKILL_RESOURCE_COMPONENT,
  isValidSkillName,
  skillBodySchema,
  type SkillBody,
  type SkillOrigin,
  type SkillStatus,
} from "@freeanima/habitat/core/db/schema/entity";
import { omitUndefined } from "@freeanima/habitat/core/util";
import { getDb } from "../../client.ts";
import {
  createEntity,
  getEntity,
  listEntities,
  updateEntity,
  type EntityRow,
} from "../../entity/index.ts";

export type SkillRecord = {
  id: number;
  world_id: number;
  name: string;
  description: string;
  content: string;
  body: SkillBody;
};

function rowToSkill(row: EntityRow): SkillRecord | null {
  if (row.primary_component !== SKILL_COMPONENT) return null;
  const parsed = skillBodySchema.safeParse(row.body);
  if (!parsed.success) return null;
  return {
    id: row.id,
    world_id: row.world_id,
    name: row.title,
    description: row.summary,
    content: row.content,
    body: parsed.data,
  };
}

export async function listSkillsInWorlds(worldIds: readonly number[]): Promise<SkillRecord[]> {
  const out: SkillRecord[] = [];
  for (const worldId of worldIds) {
    const rows = await listEntities({
      world_id: worldId,
      primary_component: SKILL_COMPONENT,
      limit: 500,
    });
    for (const row of rows) {
      const skill = rowToSkill(row);
      if (skill) out.push(skill);
    }
  }
  return out;
}

export async function getSkillById(id: number): Promise<SkillRecord | null> {
  const row = await getEntity(id);
  if (!row) return null;
  return rowToSkill(row);
}

export async function findSkillByNameInWorlds(
  name: string,
  worldIds: readonly number[],
): Promise<SkillRecord | null> {
  const trimmed = name.trim();
  if (!trimmed || worldIds.length === 0) return null;
  const skills = await listSkillsInWorlds(worldIds);
  let found: SkillRecord | null = null;
  for (const worldId of worldIds) {
    const hit = skills.find((s) => s.world_id === worldId && s.name === trimmed);
    if (hit) found = hit;
  }
  return found;
}

export type CreateSkillInput = {
  world_id: number;
  name: string;
  description: string;
  content: string;
  body?: Partial<SkillBody>;
};

export async function createSkillEntity(input: CreateSkillInput): Promise<SkillRecord> {
  const name = input.name.trim();
  if (!isValidSkillName(name)) {
    throw new Error(
      `Invalid skill name '${name}': must match agentskills (lowercase, digits, hyphens)`,
    );
  }
  const body = skillBodySchema.parse({
    ...input.body,
  });
  const row = await createEntity({
    type: "content",
    world_id: input.world_id,
    components: [SKILL_COMPONENT],
    primary_component: SKILL_COMPONENT,
    title: name,
    summary: input.description.trim(),
    content: input.content,
    body,
  });
  const skill = rowToSkill(row);
  if (!skill) throw new Error("skill create failed validation");
  return skill;
}

export type UpsertSkillInput = CreateSkillInput & {
  origin?: SkillOrigin;
  status?: SkillStatus;
};

export async function upsertSkillEntity(input: UpsertSkillInput): Promise<SkillRecord> {
  const existing = await findSkillByNameInWorlds(input.name, [input.world_id]);
  const bodyPatch = skillBodySchema.parse({
    ...input.body,
    ...(input.origin != null ? { origin: input.origin } : {}),
    ...(input.status != null ? { status: input.status } : {}),
  });
  if (!existing) {
    return createSkillEntity({
      world_id: input.world_id,
      name: input.name,
      description: input.description,
      content: input.content,
      body: bodyPatch,
    });
  }
  const updated = await updateEntity(
    omitUndefined({
      id: existing.id,
      summary: input.description.trim(),
      content: input.content,
      body: bodyPatch,
    }),
  );
  const skill = updated ? rowToSkill(updated) : await getSkillById(existing.id);
  if (!skill) throw new Error("skill upsert failed");
  return skill;
}

export async function deleteSkillEntity(id: number): Promise<boolean> {
  const row = await getEntity(id);
  if (!row || row.primary_component !== SKILL_COMPONENT) return false;
  const db = getDb();
  await db
    .update(entities)
    .set({ deleted_at: new Date() })
    .where(and(eq(entities.id, id), isNull(entities.deleted_at)));
  return true;
}

export async function createSkillTextResource(input: {
  world_id: number;
  skill_id: number;
  path: string;
  content: string;
}): Promise<number> {
  const row = await createEntity({
    type: "content",
    world_id: input.world_id,
    components: [SKILL_RESOURCE_COMPONENT],
    primary_component: SKILL_RESOURCE_COMPONENT,
    title: input.path,
    summary: "",
    content: input.content,
    body: { skill_id: input.skill_id, path: input.path },
  });
  return row.id;
}

export async function listSkillResources(skillId: number): Promise<EntityRow[]> {
  const rows = await listEntities({
    primary_component: SKILL_RESOURCE_COMPONENT,
    limit: 200,
  });
  return rows.filter((r: EntityRow) => {
    const sid = (r.body as { skill_id?: unknown }).skill_id;
    return sid === skillId;
  });
}
