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

export type CreateDbSkillOpts = {
  world_id?: number;
  allowed_tools?: string[];
  denied_tools?: string[];
  origin?: SkillBody["origin"];
  status?: SkillBody["status"];
};

export async function createDbSkill(
  skills: SkillRegistry,
  name: string,
  description: string,
  content: string,
  opts?: CreateDbSkillOpts,
): Promise<SkillDef> {
  const worldId = opts?.world_id ?? getResolvedWorldContext().agent_world_id;
  const existing = await findSkillByNameInWorlds(name, [worldId]);
  if (existing) throw new Error(`Skill '${name}' already exists in this world`);
  const origin = opts?.origin ?? "user";
  if (origin === "builtin") {
    throw new Error("Cannot create builtin skills via agent tools");
  }
  const status = opts?.status ?? "active";
  const rec = await createSkillEntity({
    world_id: worldId,
    name,
    description,
    content,
    body: {
      origin,
      status,
      allowed_tools: opts?.allowed_tools ?? [],
      denied_tools: opts?.denied_tools ?? [],
    },
  });
  const def = recordToDef(rec);
  skills.register(def);
  return def;
}

export type PatchDbSkillOpts = {
  replace_all?: boolean;
};

/** Targeted find-and-replace in skill body (Hermes-style patch). */
export async function patchDbSkill(
  skills: SkillRegistry,
  name: string,
  oldString: string,
  newString: string,
  opts?: PatchDbSkillOpts,
): Promise<SkillDef> {
  const trimmed = name.trim();
  const def = skills.get(trimmed);
  if (!def) throw new Error(`Skill '${trimmed}' is not registered`);
  if (def.origin === "builtin") {
    throw new Error(`Skill '${trimmed}' is builtin and cannot be patched`);
  }
  if (!oldString) throw new Error("old_string cannot be empty");
  const content = def.content;
  const count = content.split(oldString).length - 1;
  if (count === 0) {
    throw new Error(`old_string not found in skill '${trimmed}'`);
  }
  if (!opts?.replace_all && count > 1) {
    throw new Error(
      `old_string matches ${count} times in skill '${trimmed}'; pass replace_all=true or use a more unique string`,
    );
  }
  const nextContent = opts?.replace_all
    ? content.split(oldString).join(newString)
    : content.replace(oldString, newString);
  const rec = await upsertSkillEntity({
    world_id: def.worldId,
    name: def.name,
    description: def.description,
    content: nextContent,
    body: {
      origin: def.origin,
      status: def.status,
      license: def.license,
      compatibility: def.compatibility,
      metadata: def.metadata,
      allowed_tools: [...def.allowed_tools],
      denied_tools: [...def.denied_tools],
    },
    origin: def.origin,
    status: def.status,
  });
  const next = recordToDef(rec);
  skills.register(next);
  return next;
}

export type UpdateDbSkillPatch = {
  description?: string;
  content?: string;
  allowed_tools?: string[];
  denied_tools?: string[];
};

/** Replace description / content / tool lists (major edit). */
export async function updateDbSkill(
  skills: SkillRegistry,
  name: string,
  patch: UpdateDbSkillPatch,
): Promise<SkillDef> {
  const trimmed = name.trim();
  const def = skills.get(trimmed);
  if (!def) throw new Error(`Skill '${trimmed}' is not registered`);
  if (def.origin === "builtin") {
    throw new Error(`Skill '${trimmed}' is builtin and cannot be updated`);
  }
  if (
    patch.description === undefined &&
    patch.content === undefined &&
    patch.allowed_tools === undefined &&
    patch.denied_tools === undefined
  ) {
    throw new Error(
      "update requires at least one of description, content, allowed_tools, denied_tools",
    );
  }
  const rec = await upsertSkillEntity({
    world_id: def.worldId,
    name: def.name,
    description: patch.description ?? def.description,
    content: patch.content ?? def.content,
    body: {
      origin: def.origin,
      status: def.status,
      license: def.license,
      compatibility: def.compatibility,
      metadata: def.metadata,
      allowed_tools: patch.allowed_tools ?? [...def.allowed_tools],
      denied_tools: patch.denied_tools ?? [...def.denied_tools],
    },
    origin: def.origin,
    status: def.status,
  });
  const next = recordToDef(rec);
  skills.register(next);
  return next;
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
