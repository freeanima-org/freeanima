import {
  AGENT_CONFIG_COMPONENT,
  ENTITY_ROOT_WORLD_ID,
  USER_CONFIG_COMPONENT,
  WORLD_CONFIG_COMPONENT,
  worldConfigBodySchema,
} from "@freeanima/core/db/schema";
import type { EntityRow, EntitySearchHit } from "@freeanima/core/db/pg/entity";
import {
  countEntities,
  createEntity,
  EntitySearchScopeError,
  getEntity,
  listEntities,
  resolvePublicAccessibleWorldIds,
  searchEntities as searchEntitiesPg,
  updateEntity,
} from "@freeanima/core/db/pg/entity";

import { ApiHandlerError } from "./errors.ts";

function mapSearchHit(row: EntitySearchHit): EntitySearchHit {
  return row;
}

function buildWorldConfigBody(input: {
  private: boolean;
  owner_subject_id?: number;
  default_private?: boolean;
}): Record<string, unknown> {
  if (!input.private) {
    const body = { private: false, default_private: false };
    worldConfigBodySchema.parse(body);
    return body;
  }
  const body = {
    private: true,
    owner_subject_id: input.owner_subject_id,
    default_private: input.default_private ?? false,
  };
  worldConfigBodySchema.parse(body);
  return body;
}

async function assertSubjectEntity(id: number): Promise<EntityRow> {
  const row = await getEntity(id);
  if (!row || (row.type !== "agent" && row.type !== "user")) {
    throw new ApiHandlerError(400, "owner must be an agent or user subject", {
      code: "entity_invalid_owner_subject",
    });
  }
  return row;
}

async function assertNoExistingDefaultPrivateWorld(
  ownerSubjectId: number,
  excludeWorldId?: number,
): Promise<void> {
  const worlds = await listEntities({ type: "world", limit: 500 });
  const conflict = worlds.find((row: EntityRow) => {
    if (excludeWorldId != null && row.id === excludeWorldId) return false;
    const parsed = worldConfigBodySchema.safeParse(row.body);
    return (
      parsed.success &&
      parsed.data.default_private &&
      parsed.data.owner_subject_id === ownerSubjectId
    );
  });
  if (conflict) {
    throw new ApiHandlerError(400, "subject already has a default private world", {
      code: "entity_default_private_world_exists",
    });
  }
}

async function createDefaultPrivateWorldForSubject(subject: EntityRow): Promise<number> {
  await assertNoExistingDefaultPrivateWorld(subject.id);
  const worldTitle = subject.title.trim() || `Subject ${subject.id}`;
  const body = buildWorldConfigBody({
    private: true,
    owner_subject_id: subject.id,
    default_private: true,
  });
  const created = await createEntity({
    type: "world",
    world_id: ENTITY_ROOT_WORLD_ID,
    components: [WORLD_CONFIG_COMPONENT],
    primary_component: WORLD_CONFIG_COMPONENT,
    title: worldTitle,
    summary: "",
    content: "",
    body,
  });
  const aligned = await updateEntity({
    id: created.id,
    world_id: created.id,
  });
  return aligned?.id ?? created.id;
}

async function assertPrivateWorldOwnedBySubject(
  worldId: number,
  subjectId: number,
): Promise<EntityRow> {
  const world = await getEntity(worldId);
  const parsed = worldConfigBodySchema.safeParse(world?.body);
  if (
    !world ||
    world.type !== "world" ||
    !parsed.success ||
    !parsed.data.private ||
    parsed.data.owner_subject_id !== subjectId
  ) {
    throw new ApiHandlerError(400, "default private world must be owned by this subject", {
      code: "entity_invalid_default_private_world",
    });
  }
  return world;
}

async function applySubjectDefaultPrivateWorld(subjectId: number, worldId: number): Promise<void> {
  await assertPrivateWorldOwnedBySubject(worldId, subjectId);
  const worlds = await listEntities({ type: "world", limit: 500 });
  for (const row of worlds) {
    const parsed = worldConfigBodySchema.safeParse(row.body);
    if (!parsed.success || parsed.data.owner_subject_id !== subjectId) continue;
    const shouldBeDefault = row.id === worldId;
    if (parsed.data.default_private === shouldBeDefault) continue;
    await updateEntity({
      id: row.id,
      body: buildWorldConfigBody({
        private: true,
        owner_subject_id: subjectId,
        default_private: shouldBeDefault,
      }),
    });
  }
  await updateEntity({
    id: subjectId,
    body: { default_private_world_id: worldId },
  });
}

export async function listWorldEntities(opts?: { offset?: number; limit?: number }) {
  const offset = opts?.offset ?? 0;
  const limit = opts?.limit ?? 100;
  const items = await listEntities({ type: "world", offset, limit });
  const total = await countEntities({ type: "world" });
  return { items, total };
}

export async function getWorldEntity(id: number) {
  const row = await getEntity(id);
  if (!row || row.type !== "world") {
    throw new ApiHandlerError(404, "world not found", { code: "entity_world_not_found" });
  }
  return row;
}

export async function createWorldEntity(input: {
  title: string;
  summary?: string;
  content?: string;
  private: boolean;
  owner_subject_id?: number;
}) {
  if (input.private) {
    if (input.owner_subject_id == null) {
      throw new ApiHandlerError(400, "private world requires owner_subject_id", {
        code: "entity_private_world_missing_owner",
      });
    }
    await assertSubjectEntity(input.owner_subject_id);
  }

  const body = buildWorldConfigBody(input);
  const created = await createEntity({
    type: "world",
    world_id: ENTITY_ROOT_WORLD_ID,
    components: [WORLD_CONFIG_COMPONENT],
    primary_component: WORLD_CONFIG_COMPONENT,
    title: input.title,
    summary: input.summary ?? "",
    content: input.content ?? "",
    body,
  });
  const aligned = await updateEntity({
    id: created.id,
    world_id: created.id,
  });
  return aligned ?? created;
}

export async function updateWorldEntity(
  id: number,
  input: {
    title?: string;
    summary?: string;
    content?: string;
    private?: boolean;
    owner_subject_id?: number | null;
  },
) {
  const existing = await getEntity(id);
  if (!existing || existing.type !== "world") {
    throw new ApiHandlerError(404, "world not found", { code: "entity_world_not_found" });
  }

  const current = worldConfigBodySchema.safeParse(existing.body);
  const isDefaultPrivate = current.data?.default_private === true;

  let bodyPatch: Record<string, unknown> | undefined;
  if (input.private !== undefined || input.owner_subject_id !== undefined) {
    const nextPrivate = input.private ?? current.data?.private ?? false;
    const nextOwnerSubjectId =
      input.owner_subject_id !== undefined
        ? (input.owner_subject_id ?? undefined)
        : current.data?.owner_subject_id;

    if (isDefaultPrivate && !nextPrivate) {
      throw new ApiHandlerError(400, "default private world cannot be made public", {
        code: "entity_default_private_world_immutable",
      });
    }

    if (nextPrivate) {
      if (nextOwnerSubjectId == null) {
        throw new ApiHandlerError(400, "private world requires owner_subject_id", {
          code: "entity_private_world_missing_owner",
        });
      }
      await assertSubjectEntity(nextOwnerSubjectId);
    }

    bodyPatch = buildWorldConfigBody({
      private: nextPrivate,
      owner_subject_id: nextPrivate ? nextOwnerSubjectId : undefined,
      default_private: isDefaultPrivate,
    });
  }

  const updated = await updateEntity({
    id,
    title: input.title,
    summary: input.summary,
    content: input.content,
    body: bodyPatch,
  });
  if (!updated) {
    throw new ApiHandlerError(404, "world not found", { code: "entity_world_not_found" });
  }
  return updated;
}

export async function listSubjectEntities(opts?: { offset?: number; limit?: number }) {
  const offset = opts?.offset ?? 0;
  const limit = opts?.limit ?? 100;
  const items = await listEntities({ types: ["agent", "user"], offset, limit });
  const total = await countEntities({ types: ["agent", "user"] });
  return { items, total };
}

export async function getSubjectEntity(id: number) {
  const row = await getEntity(id);
  if (!row || (row.type !== "agent" && row.type !== "user")) {
    throw new ApiHandlerError(404, "subject not found", { code: "entity_subject_not_found" });
  }
  return row;
}

export async function createSubjectEntity(input: {
  type: "agent" | "user";
  title: string;
  summary?: string;
  content?: string;
}) {
  const primary = input.type === "agent" ? AGENT_CONFIG_COMPONENT : USER_CONFIG_COMPONENT;
  const created = await createEntity({
    type: input.type,
    world_id: ENTITY_ROOT_WORLD_ID,
    components: [primary],
    primary_component: primary,
    title: input.title,
    summary: input.summary ?? "",
    content: input.content ?? "",
    body: {},
  });

  const defaultPrivateWorldId = await createDefaultPrivateWorldForSubject(created);
  const withDefaultWorld = await updateEntity({
    id: created.id,
    body: { default_private_world_id: defaultPrivateWorldId },
  });

  return withDefaultWorld ?? created;
}

export async function updateSubjectEntity(
  id: number,
  input: {
    title?: string;
    summary?: string;
    content?: string;
    default_private_world_id?: number;
  },
) {
  const existing = await getEntity(id);
  if (!existing || (existing.type !== "agent" && existing.type !== "user")) {
    throw new ApiHandlerError(404, "subject not found", { code: "entity_subject_not_found" });
  }

  if (input.default_private_world_id != null) {
    await applySubjectDefaultPrivateWorld(id, input.default_private_world_id);
  }

  const updated = await updateEntity({
    id,
    title: input.title,
    summary: input.summary,
    content: input.content,
  });
  if (!updated) {
    throw new ApiHandlerError(404, "subject not found", { code: "entity_subject_not_found" });
  }
  return (await getEntity(id)) ?? updated;
}

export async function searchEntities(input: {
  query?: string;
  world_id?: number;
  global?: boolean;
  type?: "content" | "world" | "agent" | "user";
  types?: Array<"content" | "world" | "agent" | "user">;
  primary_component?: string;
  component?: string;
  filters?: Record<string, unknown>;
  created_after?: string;
  created_before?: string;
  updated_after?: string;
  updated_before?: string;
  limit?: number;
  offset?: number;
  mode?: "hybrid" | "filter_only";
}) {
  const global = input.global === true;
  let accessible_world_ids: number[] | undefined;

  if (global) {
    accessible_world_ids = await resolvePublicAccessibleWorldIds({ list: listEntities });
    if (!accessible_world_ids.length) {
      throw new ApiHandlerError(403, "no accessible worlds for global search", {
        code: "entity_search_global_forbidden",
      });
    }
  } else if (input.world_id == null || input.world_id <= 0) {
    throw new ApiHandlerError(400, "world_id is required unless global=true", {
      code: "entity_search_scope_required",
    });
  }

  try {
    const result = await searchEntitiesPg({
      query: input.query,
      world_id: global ? undefined : input.world_id,
      global,
      accessible_world_ids,
      type: input.type,
      types: input.types,
      primary_component: input.primary_component,
      component: input.component,
      filters: input.filters,
      created_after: input.created_after,
      created_before: input.created_before,
      updated_after: input.updated_after,
      updated_before: input.updated_before,
      limit: input.limit,
      offset: input.offset,
      mode: input.mode,
    });
    return {
      query: result.query,
      limit: result.limit,
      offset: result.offset,
      count: result.count,
      results: result.results.map(mapSearchHit),
    };
  } catch (err: unknown) {
    if (err instanceof EntitySearchScopeError) {
      const scopeErr = err;
      const status = scopeErr.code === "entity_search_global_forbidden" ? 403 : 400;
      throw new ApiHandlerError(status, scopeErr.message, { code: scopeErr.code });
    }
    throw err;
  }
}
