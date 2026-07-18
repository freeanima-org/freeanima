import {
  AGENT_CONFIG_COMPONENT,
  ENTITY_ROOT_WORLD_ID,
  USER_CONFIG_COMPONENT,
  WORLD_CONFIG_COMPONENT,
  normalizeWorldGrants,
  subjectConfigBodySchema,
  worldConfigBodySchema,
  type EntityRow,
  type WorldGrant,
} from "@freeanima/core/db/schema/entity";
import type { RuntimeConfig } from "@freeanima/core/config";
import { omitUndefined } from "@freeanima/core/util";
import { resolveWorldSubjectIds } from "@freeanima/core/config/worlds.ts";

import {
  createEntity,
  createEntityAtId,
  getEntity,
  listEntities,
  updateEntity,
} from "./repos/entity-crud-repo.ts";
import { assertPrivateWorldOwnedBySubject } from "./world-assert.ts";

export class EntitySubjectBootstrapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EntitySubjectBootstrapError";
  }
}

export function buildWorldConfigBody(input: {
  private: boolean;
  owner_subject_id?: number;
  default_private?: boolean;
  grants?: WorldGrant[];
}): Record<string, unknown> {
  const grants = normalizeWorldGrants(
    input.grants,
    input.private ? input.owner_subject_id : undefined,
  );
  if (!input.private) {
    const body = { private: false, default_private: false, grants };
    worldConfigBodySchema.parse(body);
    return body;
  }
  const body = {
    private: true,
    owner_subject_id: input.owner_subject_id,
    default_private: input.default_private ?? false,
    grants,
  };
  worldConfigBodySchema.parse(body);
  return body;
}

async function assertNoExistingDefaultPrivateWorld(
  ownerSubjectId: number,
  excludeWorldId?: number,
): Promise<void> {
  const worlds = await listEntities({ type: "world", limit: 500 });
  const conflict = worlds.find((row) => {
    if (excludeWorldId != null && row.id === excludeWorldId) return false;
    const parsed = worldConfigBodySchema.safeParse(row.body);
    return (
      parsed.success &&
      parsed.data.default_private &&
      parsed.data.owner_subject_id === ownerSubjectId
    );
  });
  if (conflict) {
    throw new EntitySubjectBootstrapError(
      `subject ${ownerSubjectId} already has default private world ${conflict.id}`,
    );
  }
}

export async function createDefaultPrivateWorldForSubject(subject: EntityRow): Promise<number> {
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

async function ensureDefaultPrivateWorldOnSubject(subject: EntityRow): Promise<number> {
  const parsed = subjectConfigBodySchema.safeParse(subject.body);
  const existingWorldId = parsed.success ? parsed.data.default_private_world_id : undefined;
  if (existingWorldId != null && existingWorldId > 0) {
    await assertPrivateWorldOwnedBySubject(existingWorldId, subject.id);
    return existingWorldId;
  }

  const worldId = await createDefaultPrivateWorldForSubject(subject);
  await updateEntity({
    id: subject.id,
    body: { default_private_world_id: worldId },
  });
  return worldId;
}

function defaultSubjectTitle(type: "user" | "agent"): string {
  return type === "user" ? "用户" : "Agent";
}

async function createSubjectRowAtId(
  id: number,
  type: "user" | "agent",
  title: string,
): Promise<EntityRow> {
  const primary = type === "agent" ? AGENT_CONFIG_COMPONENT : USER_CONFIG_COMPONENT;
  return createEntityAtId({
    id,
    type,
    world_id: ENTITY_ROOT_WORLD_ID,
    components: [primary],
    primary_component: primary,
    title,
    summary: "",
    content: "",
    body: {},
  });
}

async function createSubjectAtId(
  id: number,
  type: "user" | "agent",
  title: string,
): Promise<EntityRow> {
  const created = await createSubjectRowAtId(id, type, title);
  const worldId = await createDefaultPrivateWorldForSubject(created);
  const withDefault = await updateEntity({
    id: created.id,
    body: { default_private_world_id: worldId },
  });
  return withDefault ?? created;
}

async function createSubjectNextId(type: "user" | "agent", title: string): Promise<EntityRow> {
  const primary = type === "agent" ? AGENT_CONFIG_COMPONENT : USER_CONFIG_COMPONENT;
  const created = await createEntity({
    type,
    world_id: ENTITY_ROOT_WORLD_ID,
    components: [primary],
    primary_component: primary,
    title,
    summary: "",
    content: "",
    body: {},
  });
  const worldId = await createDefaultPrivateWorldForSubject(created);
  const withDefault = await updateEntity({
    id: created.id,
    body: { default_private_world_id: worldId },
  });
  return withDefault ?? created;
}

async function ensureSubjectAtId(
  id: number,
  expectedType: "user" | "agent",
  opts?: { bootstrapWorld?: boolean },
): Promise<EntityRow> {
  const bootstrapWorld = opts?.bootstrapWorld ?? true;
  const existing = await getEntity(id);
  if (existing) {
    if (existing.type !== expectedType) {
      throw new EntitySubjectBootstrapError(
        `entity id=${id} has type=${existing.type}, expected ${expectedType}`,
      );
    }
    if (bootstrapWorld) {
      await ensureDefaultPrivateWorldOnSubject(existing);
    }
    const refreshed = await getEntity(id);
    if (!refreshed) {
      throw new EntitySubjectBootstrapError(`subject ${id} disappeared after ensure`);
    }
    return refreshed;
  }

  if (bootstrapWorld) {
    return createSubjectAtId(id, expectedType, defaultSubjectTitle(expectedType));
  }
  return createSubjectRowAtId(id, expectedType, defaultSubjectTitle(expectedType));
}

/** 有配置 id 则 ensure 固定 id；否则取同 type 最小 id，没有则 next-id 创建 */
async function resolveOrCreateSubject(
  expectedType: "user" | "agent",
  configuredId?: number,
): Promise<EntityRow> {
  if (configuredId != null) {
    return ensureSubjectAtId(configuredId, expectedType, { bootstrapWorld: false });
  }

  const existing = await listEntities({ type: expectedType, limit: 1 });
  if (existing[0]) {
    return existing[0];
  }
  return createSubjectNextId(expectedType, defaultSubjectTitle(expectedType));
}

export type EnsuredWorldSubjects = {
  user_subject_id: number;
  agent_subject_id: number;
  user_world_id: number;
  agent_world_id: number;
};

function readSubjectWorldId(subject: EntityRow): number {
  const parsed = subjectConfigBodySchema.safeParse(subject.body);
  const worldId = parsed.success ? parsed.data.default_private_world_id : undefined;
  if (worldId == null || worldId <= 0) {
    throw new EntitySubjectBootstrapError(
      `subject ${subject.id} has no default_private_world_id after ensure`,
    );
  }
  return worldId;
}

/** Hub 启动：确保 user/agent subject 及默认私有 world 存在 */
export async function ensureWorldSubjects(config: RuntimeConfig): Promise<EnsuredWorldSubjects> {
  const { user_subject_id, agent_subject_id } = resolveWorldSubjectIds(config);

  const userSubject = await resolveOrCreateSubject("user", user_subject_id);
  const agentSubject = await resolveOrCreateSubject("agent", agent_subject_id);

  await ensureDefaultPrivateWorldOnSubject(userSubject);
  await ensureDefaultPrivateWorldOnSubject(agentSubject);

  const userRefreshed = await getEntity(userSubject.id);
  const agentRefreshed = await getEntity(agentSubject.id);
  if (!userRefreshed || !agentRefreshed) {
    throw new EntitySubjectBootstrapError("subject disappeared after default world bootstrap");
  }

  return {
    user_subject_id: userRefreshed.id,
    agent_subject_id: agentRefreshed.id,
    user_world_id: readSubjectWorldId(userRefreshed),
    agent_world_id: readSubjectWorldId(agentRefreshed),
  };
}

/** Console：创建 subject（不固定 id） */
export async function createSubjectEntityRecord(input: {
  type: "agent" | "user";
  title: string;
  summary?: string;
  content?: string;
}): Promise<EntityRow> {
  const created = await createSubjectNextId(
    input.type,
    input.title.trim() || defaultSubjectTitle(input.type),
  );
  if (input.summary || input.content) {
    const updated = await updateEntity(
      omitUndefined({
        id: created.id,
        summary: input.summary,
        content: input.content,
      }),
    );
    return updated ?? created;
  }
  return created;
}
