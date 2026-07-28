import { getResolvedWorldContext } from "@freeanima/host/core/config";
import {
  createSkillEntity,
  deleteSkillEntity,
  findSkillByNameInWorlds,
  listSkillsInWorlds,
  upsertSkillEntity,
  type SkillRecord,
} from "@freeanima/host/core/db/pg/skill";
import {
  isValidSkillName,
  skillOriginSchema,
  skillStatusSchema,
  type SkillBody,
} from "@freeanima/host/core/db/schema/entity";
import { omitUndefined } from "@freeanima/host/core/util";
import {
  normalizeToolList,
  parseFrontmatter,
  serializeSkillMarkdown,
  stripFrontmatter,
} from "./content.ts";
import { skillDefFromBody, type SkillDef, type SkillRegistry } from "./registry.ts";

export function catalogWorldIds(): number[] {
  const ctx = getResolvedWorldContext();
  return [ctx.commons_world_id, ctx.agent_world_id];
}

function recordToDef(rec: SkillRecord): SkillDef {
  return skillDefFromBody(
    {
      name: rec.name,
      description: rec.description,
      entityId: rec.id,
      worldId: rec.world_id,
      content: rec.content,
      source: rec.body.origin,
    },
    rec.body,
  );
}

/** 从 DB hydrate：commons ∪ agent private；同名 private 覆盖 */
export async function hydrateSkillRegistry(skills: SkillRegistry): Promise<number> {
  const worldIds = catalogWorldIds();
  const records = await listSkillsInWorlds(worldIds);
  const byName = new Map<string, SkillRecord>();
  for (const worldId of worldIds) {
    for (const rec of records) {
      if (rec.world_id === worldId) byName.set(rec.name, rec);
    }
  }
  skills.clear();
  for (const rec of byName.values()) {
    skills.register(recordToDef(rec));
  }
  return byName.size;
}

export function frontmatterToBody(fm: ReturnType<typeof parseFrontmatter>): Partial<SkillBody> {
  const allowed = normalizeToolList(fm["allowed-tools"] ?? fm.allowed_tools);
  const denied = normalizeToolList(fm.denied_tools);
  const origin = skillOriginSchema.safeParse(fm.origin);
  const status = skillStatusSchema.safeParse(fm.status);
  const meta = { ...fm.metadata };
  return omitUndefined({
    license: fm.license,
    compatibility: fm.compatibility,
    metadata: meta,
    allowed_tools: allowed,
    denied_tools: denied,
    origin: origin.success ? origin.data : undefined,
    status: status.success ? status.data : undefined,
  });
}

export async function importSkillMarkdown(
  skills: SkillRegistry,
  markdown: string,
  opts?: { world_id?: number; origin?: SkillBody["origin"] },
): Promise<SkillDef> {
  const fm = parseFrontmatter(markdown);
  const name = (fm.name ?? "").trim();
  if (!isValidSkillName(name)) {
    throw new Error(`Invalid or missing skill name in frontmatter`);
  }
  const description = (fm.description ?? "").trim();
  const content = stripFrontmatter(markdown);
  const body = frontmatterToBody(fm);
  if (opts?.origin) body.origin = opts.origin;
  const worldId = opts?.world_id ?? getResolvedWorldContext().agent_world_id;
  const rec = await upsertSkillEntity(
    omitUndefined({
      world_id: worldId,
      name,
      description,
      content,
      body,
      origin: body.origin,
      status: body.status,
    }),
  );
  const def = recordToDef(rec);
  skills.register(def);
  return def;
}

export async function exportSkillMarkdown(skills: SkillRegistry, name: string): Promise<string> {
  const def = skills.get(name.trim());
  if (!def) throw new Error(`Skill '${name}' not found`);
  return serializeSkillMarkdown(
    omitUndefined({
      name: def.name,
      description: def.description,
      content: def.content,
      license: def.license,
      compatibility: def.compatibility,
      allowed_tools: def.allowed_tools,
      denied_tools: def.denied_tools,
      origin: def.origin,
      status: def.status,
      metadata: def.metadata,
    }),
  );
}

export async function createDbSkill(
  skills: SkillRegistry,
  name: string,
  description: string,
  content: string,
  opts?: { world_id?: number; allowed_tools?: string[] },
): Promise<SkillDef> {
  const worldId = opts?.world_id ?? getResolvedWorldContext().agent_world_id;
  const existing = await findSkillByNameInWorlds(name, [worldId]);
  if (existing) throw new Error(`Skill '${name}' already exists in this world`);
  const rec = await createSkillEntity({
    world_id: worldId,
    name,
    description,
    content,
    body: {
      origin: "user",
      status: "active",
      allowed_tools: opts?.allowed_tools ?? [],
    },
  });
  const def = recordToDef(rec);
  skills.register(def);
  return def;
}

export async function deleteDbSkill(skills: SkillRegistry, name: string): Promise<void> {
  const def = skills.get(name.trim());
  if (!def) throw new Error(`Skill '${name}' is not registered`);
  if (def.origin === "builtin") {
    throw new Error(`Skill '${name}' is builtin and cannot be deleted`);
  }
  await deleteSkillEntity(def.entityId);
  skills.unregister(name.trim());
}
