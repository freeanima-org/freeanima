import type { SubjectKind } from "@freeanima/host/core/config";
import { resolveSubjectWorldId } from "@freeanima/host/core/config/world-context";
import { isPostgresPrimary } from "@freeanima/host/core/db/pg";
import {
  collectEntityReferences,
  countEntities,
  deleteEntity,
  deleteEntityComponent,
  getEntity,
  listEntities,
  restoreEntity,
  type EntityRow,
} from "@freeanima/host/core/db/pg/entity";
import type { VerifiedServiceApiToken } from "@freeanima/host/core/db/pg/service-api-token";
import type { EntityAdminRowPayload } from "@freeanima/shared/rpc-contract/frames/entity";
import type { RpcRequestAuthContext } from "@freeanima/shared/rpc-contract";

import type { RuntimeDeps } from "./runtime-deps.ts";

function assertPg(_deps: RuntimeDeps): void {
  if (!isPostgresPrimary()) {
    throw new Error("PostgreSQL unavailable");
  }
}

function assertSubjectKindMatches(auth: RpcRequestAuthContext, subject_kind?: SubjectKind): void {
  if (!subject_kind || subject_kind === auth.subject_type) return;
  if (auth.subject_type === "user" && subject_kind === "agent") return;
  throw new Error("FORBIDDEN_SUBJECT");
}

function resolveSubjectKind(subject_kind: SubjectKind | undefined): SubjectKind {
  if (subject_kind !== "user" && subject_kind !== "agent") {
    throw new Error("subject_kind is required (user|agent)");
  }
  return subject_kind;
}

async function entityWorldIdForAuth(
  auth: RpcRequestAuthContext,
  subject_kind?: SubjectKind,
): Promise<number> {
  const kind = resolveSubjectKind(subject_kind);
  assertSubjectKindMatches(auth, kind);
  return resolveSubjectWorldId(kind);
}

function toAdminRow(row: EntityRow): EntityAdminRowPayload {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    primary_component: row.primary_component,
    components: row.components,
    updated_at: row.updated_at.toISOString(),
    deleted_at: row.deleted_at?.toISOString() ?? null,
    world_id: row.world_id,
  };
}

async function assertEntityInWorld(id: number, world_id: number, include_deleted = false) {
  const row = await getEntity(id, { include_deleted });
  if (!row || row.world_id !== world_id) {
    throw new Error("entity not found");
  }
  return row;
}

export async function serviceEntityList(
  deps: RuntimeDeps,
  input: { subject_kind?: SubjectKind; limit?: number; offset?: number } | undefined,
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const world_id = await entityWorldIdForAuth(auth, input?.subject_kind);
  const limit = input?.limit ?? 100;
  const offset = input?.offset ?? 0;
  const listOpts = {
    world_id,
    deleted: "alive" as const,
    order_by: "updated_at" as const,
    order_dir: "desc" as const,
    limit,
    offset,
  };
  const [items, count] = await Promise.all([
    listEntities(listOpts),
    countEntities({
      world_id,
      deleted: "alive",
    }),
  ]);
  return { items: items.map(toAdminRow), count };
}

export async function serviceEntityTrashList(
  deps: RuntimeDeps,
  input: { subject_kind?: SubjectKind; limit?: number; offset?: number } | undefined,
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const world_id = await entityWorldIdForAuth(auth, input?.subject_kind);
  const limit = input?.limit ?? 100;
  const offset = input?.offset ?? 0;
  const listOpts = {
    world_id,
    deleted: "deleted" as const,
    order_by: "deleted_at" as const,
    order_dir: "desc" as const,
    limit,
    offset,
  };
  const [items, count] = await Promise.all([
    listEntities(listOpts),
    countEntities({
      world_id,
      deleted: "deleted",
    }),
  ]);
  return { items: items.map(toAdminRow), count };
}

export async function serviceEntityDelete(
  deps: RuntimeDeps,
  input: { subject_kind?: SubjectKind; id: number; force?: boolean },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const world_id = await entityWorldIdForAuth(auth, input.subject_kind);
  await assertEntityInWorld(input.id, world_id);

  if (!input.force) {
    const references = await collectEntityReferences(input.id);
    if (references.length > 0) {
      return { ok: false as const, references };
    }
  }

  const ok = await deleteEntity(input.id);
  if (!ok) throw new Error("entity not found");
  return { ok: true as const };
}

export async function serviceEntityRestore(
  deps: RuntimeDeps,
  input: { subject_kind?: SubjectKind; id: number },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const world_id = await entityWorldIdForAuth(auth, input.subject_kind);
  await assertEntityInWorld(input.id, world_id, true);
  const row = await restoreEntity(input.id);
  if (!row) throw new Error("entity not found");
  return { ok: true as const };
}

export async function serviceEntityDeleteComponent(
  deps: RuntimeDeps,
  input: { subject_kind?: SubjectKind; id: number; component: string },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const world_id = await entityWorldIdForAuth(auth, input.subject_kind);
  await assertEntityInWorld(input.id, world_id);
  const row = await deleteEntityComponent(input.id, input.component);
  if (!row) throw new Error("entity not found");
  return { item: toAdminRow(row) };
}
