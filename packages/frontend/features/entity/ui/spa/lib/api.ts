import { getUserSubjectId } from "@freeanima/client/portal-sdk/world-context.ts";
import type {
  EntityAdminRowPayload,
  EntityAdminType,
  EntityDeleteOutput,
  EntityDetailPayload,
  EntityListOutput,
  EntityTrashListOutput,
} from "@freeanima/shared/rpc-contract/frames/entity.ts";
import { getTypedHabitatClient } from "@freeanima/client/portal-sdk/habitat-typed-client.ts";

export type EntityAdminRow = EntityAdminRowPayload;
export type EntityDetail = EntityDetailPayload;

export type EntityListQuery = {
  limit?: number;
  offset?: number;
  type?: EntityAdminType;
  primary_component?: string;
  query?: string;
};

function habitat() {
  return getTypedHabitatClient();
}

async function withSubjectId<T extends Record<string, unknown>>(payload: T) {
  return { subject_id: await getUserSubjectId(), ...payload };
}

export async function fetchEntities(opts?: EntityListQuery): Promise<EntityListOutput> {
  return habitat().call("entity.list", await withSubjectId(opts ?? {}));
}

export async function fetchEntityTrash(opts?: EntityListQuery): Promise<EntityTrashListOutput> {
  return habitat().call("entity.trash.list", await withSubjectId(opts ?? {}));
}

export async function fetchEntityDetail(
  id: number,
  opts?: { includeDeleted?: boolean },
): Promise<EntityDetail> {
  const data = await habitat().call("entity.get", {
    id,
    ...(opts?.includeDeleted ? { include_deleted: true } : {}),
  });
  return data.item;
}

export async function deleteEntity(id: number, force = false): Promise<EntityDeleteOutput> {
  return habitat().call(
    "entity.delete",
    await withSubjectId({ id, ...(force ? { force: true } : {}) }),
  );
}

export async function restoreEntity(id: number): Promise<void> {
  await habitat().call("entity.restore", await withSubjectId({ id }));
}

export async function deleteEntityComponent(
  id: number,
  component: string,
): Promise<EntityAdminRow> {
  const data = await habitat().call(
    "entity.deleteComponent",
    await withSubjectId({ id, component }),
  );
  return data.item;
}

export async function addEntityComponent(
  id: number,
  component: string,
  opts?: { body?: Record<string, unknown>; promotePrimary?: boolean },
): Promise<EntityAdminRow> {
  const data = await habitat().call(
    "entity.addComponent",
    await withSubjectId({
      id,
      component,
      ...(opts?.body != null ? { body: opts.body } : {}),
      ...(opts?.promotePrimary === true ? { promote_primary: true } : {}),
    }),
  );
  return data.item;
}

export async function setPrimaryComponent(id: number, component: string): Promise<EntityAdminRow> {
  const data = await habitat().call(
    "entity.setPrimaryComponent",
    await withSubjectId({ id, component }),
  );
  return data.item;
}
