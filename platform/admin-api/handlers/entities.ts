import {
  AGENT_CONFIG_COMPONENT,
  ENTITY_ROOT_WORLD_ID,
  USER_CONFIG_COMPONENT,
  WORLD_CONFIG_COMPONENT,
} from "@freeanima/core/db/schema";
import type { EntityRow } from "@freeanima/core/repos";

import { ApiHandlerError } from "./errors.ts";
import { adminCtx } from "./runtime.ts";

function mapEntity(row: EntityRow): EntityRow {
  return row;
}

export async function listWorldEntities(opts?: { offset?: number; limit?: number }) {
  const store = adminCtx().engine.repos.entity;
  const offset = opts?.offset ?? 0;
  const limit = opts?.limit ?? 100;
  const items = await store.list({ type: "world", offset, limit });
  const total = await store.count({ type: "world" });
  return { items: items.map(mapEntity), total };
}

export async function getWorldEntity(id: number) {
  const row = await adminCtx().engine.repos.entity.get(id);
  if (!row || row.type !== "world") {
    throw new ApiHandlerError(404, "world not found", { code: "entity_world_not_found" });
  }
  return mapEntity(row);
}

export async function createWorldEntity(input: {
  title: string;
  summary?: string;
  content?: string;
  owner_id?: number | null;
}) {
  const store = adminCtx().engine.repos.entity;
  const created = await store.create({
    type: "world",
    world_id: ENTITY_ROOT_WORLD_ID,
    owner_id: input.owner_id ?? null,
    components: [WORLD_CONFIG_COMPONENT],
    primary_component: WORLD_CONFIG_COMPONENT,
    title: input.title,
    summary: input.summary ?? "",
    content: input.content ?? "",
    body: {},
  });
  const aligned = await store.update({
    id: created.id,
    world_id: created.id,
  });
  return mapEntity(aligned ?? created);
}

export async function updateWorldEntity(
  id: number,
  input: {
    title?: string;
    summary?: string;
    content?: string;
    owner_id?: number | null;
  },
) {
  const store = adminCtx().engine.repos.entity;
  const existing = await store.get(id);
  if (!existing || existing.type !== "world") {
    throw new ApiHandlerError(404, "world not found", { code: "entity_world_not_found" });
  }
  const updated = await store.update({
    id,
    title: input.title,
    summary: input.summary,
    content: input.content,
    owner_id: input.owner_id,
  });
  if (!updated) {
    throw new ApiHandlerError(404, "world not found", { code: "entity_world_not_found" });
  }
  return mapEntity(updated);
}

export async function listSubjectEntities(opts?: { offset?: number; limit?: number }) {
  const store = adminCtx().engine.repos.entity;
  const offset = opts?.offset ?? 0;
  const limit = opts?.limit ?? 100;
  const items = await store.list({ types: ["agent", "user"], offset, limit });
  const total = await store.count({ types: ["agent", "user"] });
  return { items: items.map(mapEntity), total };
}

export async function getSubjectEntity(id: number) {
  const row = await adminCtx().engine.repos.entity.get(id);
  if (!row || (row.type !== "agent" && row.type !== "user")) {
    throw new ApiHandlerError(404, "subject not found", { code: "entity_subject_not_found" });
  }
  return mapEntity(row);
}

export async function createSubjectEntity(input: {
  type: "agent" | "user";
  title: string;
  summary?: string;
  content?: string;
  world_id?: number;
}) {
  const store = adminCtx().engine.repos.entity;
  const primary = input.type === "agent" ? AGENT_CONFIG_COMPONENT : USER_CONFIG_COMPONENT;
  const created = await store.create({
    type: input.type,
    world_id: input.world_id ?? ENTITY_ROOT_WORLD_ID,
    owner_id: null,
    components: [primary],
    primary_component: primary,
    title: input.title,
    summary: input.summary ?? "",
    content: input.content ?? "",
    body: {},
  });
  const withOwner = await store.update({
    id: created.id,
    owner_id: created.id,
  });
  return mapEntity(withOwner ?? created);
}

export async function updateSubjectEntity(
  id: number,
  input: {
    title?: string;
    summary?: string;
    content?: string;
    world_id?: number;
  },
) {
  const store = adminCtx().engine.repos.entity;
  const existing = await store.get(id);
  if (!existing || (existing.type !== "agent" && existing.type !== "user")) {
    throw new ApiHandlerError(404, "subject not found", { code: "entity_subject_not_found" });
  }
  const updated = await store.update({
    id,
    title: input.title,
    summary: input.summary,
    content: input.content,
    world_id: input.world_id,
  });
  if (!updated) {
    throw new ApiHandlerError(404, "subject not found", { code: "entity_subject_not_found" });
  }
  return mapEntity(updated);
}
