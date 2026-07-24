import { subjectConfigBodySchema } from "@freeanima/host/core/db/schema";
import { resolveToolCallerSubjectId } from "@freeanima/host/core/tool";

import { getEntity, listEntities } from "./repos/entity-crud-repo.ts";
import { resolveWorldsAccessibleBySubject } from "./search/accessible-worlds.ts";
import {
  accessLevelMeets,
  subjectWorldAccessLevel,
  type SubjectWorldAccessLevel,
} from "./subject-world-access.ts";

export class ToolWorldAccessError extends Error {
  override name = "ToolWorldAccessError";
}

/** subject entity → default_private_world_id */
export async function resolveDefaultPrivateWorldForSubject(subjectId: number): Promise<number> {
  const row = await getEntity(subjectId);
  if (!row || (row.type !== "user" && row.type !== "agent")) {
    throw new ToolWorldAccessError(`subject not found: ${subjectId}`);
  }
  const parsed = subjectConfigBodySchema.safeParse(row.body);
  const worldId = parsed.success ? parsed.data.default_private_world_id : undefined;
  if (worldId == null || worldId <= 0) {
    throw new ToolWorldAccessError(`subject ${subjectId} has no default_private_world_id`);
  }
  return worldId;
}

export async function getSubjectWorldAccessLevel(
  subjectId: number,
  worldId: number,
): Promise<SubjectWorldAccessLevel> {
  const row = await getEntity(worldId);
  if (!row || row.type !== "world") {
    throw new ToolWorldAccessError(`world not found: ${worldId}`);
  }
  return subjectWorldAccessLevel(row.body ?? {}, subjectId);
}

export async function assertSubjectCanAccessWorld(
  subjectId: number,
  worldId: number,
  opts?: { access?: "read" | "write" },
): Promise<void> {
  const required = opts?.access ?? "read";
  const level = await getSubjectWorldAccessLevel(subjectId, worldId);
  if (!accessLevelMeets(level, required)) {
    throw new ToolWorldAccessError(
      required === "write"
        ? `subject ${subjectId} cannot write world ${worldId}`
        : `subject ${subjectId} cannot access world ${worldId}`,
    );
  }
}

export async function resolveWorldFromEntityId(entityId: number): Promise<number> {
  const row = await getEntity(entityId);
  if (!row) {
    throw new ToolWorldAccessError(`entity not found: ${entityId}`);
  }
  return row.world_id;
}

export async function resolveDefaultWorldForToolCaller(): Promise<number> {
  return resolveDefaultPrivateWorldForSubject(resolveToolCallerSubjectId());
}

export type ResolveToolWorldOpts = {
  explicitWorldId?: number;
  entityId?: number;
  listId?: number;
  /** 默认 read；创建/更新/删除工具应传 write */
  access?: "read" | "write";
};

/** Unified world scope for MCP / LLM tools (caller subject from ToolContext). */
export async function resolveToolWorld(opts: ResolveToolWorldOpts): Promise<number> {
  const callerSubjectId = resolveToolCallerSubjectId();
  const access = opts.access ?? "read";

  if (opts.entityId != null && opts.entityId > 0) {
    const worldId = await resolveWorldFromEntityId(opts.entityId);
    await assertSubjectCanAccessWorld(callerSubjectId, worldId, { access });
    return worldId;
  }

  if (opts.listId != null && opts.listId > 0) {
    const worldId = await resolveWorldFromEntityId(opts.listId);
    await assertSubjectCanAccessWorld(callerSubjectId, worldId, { access });
    return worldId;
  }

  if (opts.explicitWorldId != null && opts.explicitWorldId > 0) {
    await assertSubjectCanAccessWorld(callerSubjectId, opts.explicitWorldId, { access });
    return opts.explicitWorldId;
  }

  // 调用方自己的 default private world：owner 满权限，无需再 assert
  return resolveDefaultPrivateWorldForSubject(callerSubjectId);
}

/** 供搜索列举：subject 可读的全部 world */
export async function listWorldIdsAccessibleBySubject(subjectId: number): Promise<number[]> {
  return resolveWorldsAccessibleBySubject({ list: listEntities }, subjectId);
}
