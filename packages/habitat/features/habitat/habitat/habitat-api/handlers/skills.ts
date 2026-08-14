import { getAppRuntime } from "@freeanima/habitat/platform/ports";
import { getSkillById, findSkillByNameInWorlds } from "@freeanima/habitat/core/db/pg/skill";
import { getResolvedWorldContext } from "@freeanima/habitat/core/config";
import { omitUndefined } from "@freeanima/habitat/core/util";

export async function listHabitatSkills(): Promise<{
  skills: Array<{
    name: string;
    description: string;
    origin: string;
    status: string;
    entity_id: number;
    world_id: number;
    allowed_tools: string[];
    denied_tools: string[];
  }>;
}> {
  const runtime = getAppRuntime();
  const defs = runtime.engine.skills.list();
  return {
    skills: defs.map((d) => ({
      name: d.name,
      description: d.description,
      origin: d.origin,
      status: d.status,
      entity_id: d.entityId,
      world_id: d.worldId,
      allowed_tools: [...d.allowed_tools],
      denied_tools: [...d.denied_tools],
    })),
  };
}

export async function getHabitatSkill(name: string): Promise<{
  name: string;
  description: string;
  origin: string;
  status: string;
  entity_id: number;
  world_id: number;
  allowed_tools: string[];
  denied_tools: string[];
  license?: string;
  compatibility?: string;
  content: string;
  resources: Array<{ path: string; entity_id: number; kind: string }>;
} | null> {
  const runtime = getAppRuntime();
  const def = runtime.engine.skills.get(name.trim());
  if (!def) {
    const ctx = getResolvedWorldContext();
    const rec = await findSkillByNameInWorlds(name, [ctx.commons_world_id, ctx.agent_world_id]);
    if (!rec) return null;
    return omitUndefined({
      name: rec.name,
      description: rec.description,
      origin: rec.body.origin,
      status: rec.body.status,
      entity_id: rec.id,
      world_id: rec.world_id,
      allowed_tools: rec.body.allowed_tools,
      denied_tools: rec.body.denied_tools,
      license: rec.body.license,
      compatibility: rec.body.compatibility,
      content: rec.content,
      resources: rec.body.resources.map((r) => ({
        path: r.path,
        entity_id: r.entity_id,
        kind: r.kind,
      })),
    });
  }
  const row = await getSkillById(def.entityId);
  return omitUndefined({
    name: def.name,
    description: def.description,
    origin: def.origin,
    status: def.status,
    entity_id: def.entityId,
    world_id: def.worldId,
    allowed_tools: [...def.allowed_tools],
    denied_tools: [...def.denied_tools],
    license: def.license,
    compatibility: def.compatibility,
    content: def.content,
    resources: (row?.body.resources ?? []).map((r) => ({
      path: r.path,
      entity_id: r.entity_id,
      kind: r.kind,
    })),
  });
}
