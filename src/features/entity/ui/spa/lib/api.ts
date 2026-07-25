import { getSubjectKind } from "@freeanima/client/portal-sdk";
import type {
  EntityAdminRowPayload,
  EntityDeleteOutput,
  EntityListOutput,
  EntityTrashListOutput,
} from "@freeanima/shared/rpc-contract/frames/entity.ts";
import { getTypedHabitatClient } from "@freeanima/client/portal-sdk/habitat-typed-client.ts";

export type EntityAdminRow = EntityAdminRowPayload;

function habitat() {
  return getTypedHabitatClient();
}

function withSubjectKind<T extends Record<string, unknown>>(payload: T) {
  return { subject_kind: getSubjectKind(), ...payload };
}

export async function fetchEntities(opts?: {
  limit?: number;
  offset?: number;
}): Promise<EntityListOutput> {
  return habitat().call("entity.list", withSubjectKind(opts ?? {}));
}

export async function fetchEntityTrash(opts?: {
  limit?: number;
  offset?: number;
}): Promise<EntityTrashListOutput> {
  return habitat().call("entity.trash.list", withSubjectKind(opts ?? {}));
}

export async function deleteEntity(id: number, force = false): Promise<EntityDeleteOutput> {
  return habitat().call(
    "entity.delete",
    withSubjectKind({ id, ...(force ? { force: true } : {}) }),
  );
}

export async function restoreEntity(id: number): Promise<void> {
  await habitat().call("entity.restore", withSubjectKind({ id }));
}

export async function deleteEntityComponent(
  id: number,
  component: string,
): Promise<EntityAdminRow> {
  const data = await habitat().call("entity.deleteComponent", withSubjectKind({ id, component }));
  return data.item;
}
