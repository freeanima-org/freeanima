import type { SubjectKind } from "@freeanima/habitat/core/config";
import { resolveSubjectWorldId } from "@freeanima/habitat/core/config/world-context";
import { isPostgresPrimary } from "@freeanima/habitat/core/db/pg";
import {
  assertSubjectCanAccessWorld,
  collectEntityReferences,
  countEntities,
  deleteEntity,
  deleteEntityComponent,
  addEntityComponent,
  promoteEntityComponent,
  getEntity,
  isUserAgentPrivateWorldPassthrough,
  listEntities,
  restoreEntity,
  searchEntities,
  ToolWorldAccessError,
  type EntityDeletedFilter,
  type EntityRow,
  type EntitySearchHit,
} from "@freeanima/habitat/core/db/pg/entity";
import type { EntityType } from "@freeanima/habitat/core/db/schema";
import type { VerifiedServiceApiToken } from "@freeanima/habitat/core/db/pg/service-api-token";
import type {
  EntityAdminRowPayload,
  EntityDetailPayload,
  EntityListInput,
} from "@freeanima/shared/rpc-contract/frames/entity";
import type { RpcRequestAuthContext } from "@freeanima/shared/rpc-contract";

import { assertAttachAllowed, assertPromoteAllowed } from "../domain/attach-policy.ts";
import { parseEntityListQueryId } from "./parse-entity-list-query-id.ts";
import type { RuntimeDeps } from "./runtime-deps.ts";

const LIST_PREVIEW_MAX = 120;

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

function truncatePreview(text: string, max = LIST_PREVIEW_MAX): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

/** 列表行展示用：summary → content 截断 → 搜索 snippet */
function listPreviewSummary(row: EntityRow, snippet?: string): string {
  const summary = row.summary.trim();
  if (summary) return summary;
  const content = row.content.trim();
  if (content) return truncatePreview(content);
  const snip = snippet?.trim();
  return snip ? truncatePreview(snip) : "";
}

function toAdminRow(row: EntityRow, snippet?: string): EntityAdminRowPayload {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    summary: listPreviewSummary(row, snippet),
    primary_component: row.primary_component,
    components: row.components,
    updated_at: row.updated_at.toISOString(),
    deleted_at: row.deleted_at?.toISOString() ?? null,
    world_id: row.world_id,
  };
}

function toDetailRow(row: EntityRow): EntityDetailPayload {
  return {
    ...toAdminRow(row),
    summary: row.summary,
    content: row.content,
    body: row.body,
    pinned: row.pinned,
    reference_count: row.reference_count,
    tag_ids: row.tag_ids,
    revision_count: row.revisions.length,
    created_at: row.created_at.toISOString(),
  };
}

async function assertEntityInWorld(id: number, world_id: number, include_deleted = false) {
  const row = await getEntity(id, { include_deleted });
  if (!row || row.world_id !== world_id) {
    throw new Error("entity not found");
  }
  return row;
}

type EntityAdminListInput = Omit<EntityListInput, "subject_kind"> & {
  subject_kind?: SubjectKind;
};

function matchesAdminFilters(
  row: EntityRow,
  opts: { type?: EntityType; primary_component?: string },
): boolean {
  if (opts.type && row.type !== opts.type) return false;
  if (opts.primary_component && row.primary_component !== opts.primary_component) return false;
  return true;
}

function matchesDeletedFilter(row: EntityRow, deleted: EntityDeletedFilter): boolean {
  if (deleted === "alive") return row.deleted_at == null;
  if (deleted === "deleted") return row.deleted_at != null;
  return true;
}

function mapSearchHitToAdminRow(hit: EntitySearchHit): EntityAdminRowPayload {
  return toAdminRow(hit, hit.snippet);
}

async function serviceEntityAdminList(
  deps: RuntimeDeps,
  input: EntityAdminListInput | undefined,
  auth: VerifiedServiceApiToken,
  deleted: "alive" | "deleted",
) {
  assertPg(deps);
  const world_id = await entityWorldIdForAuth(auth, input?.subject_kind);
  const limit = input?.limit ?? 100;
  const offset = input?.offset ?? 0;
  const type = input?.type;
  const primary_component = input?.primary_component?.trim() || undefined;
  const query = input?.query?.trim() || undefined;

  if (query) {
    const id = parseEntityListQueryId(query);
    if (id != null) {
      const row = await getEntity(id, { include_deleted: true });
      const filterMatch = {
        ...(type ? { type } : {}),
        ...(primary_component ? { primary_component } : {}),
      };
      if (
        !row ||
        row.world_id !== world_id ||
        !matchesDeletedFilter(row, deleted) ||
        !matchesAdminFilters(row, filterMatch)
      ) {
        return { items: [], count: 0 };
      }
      return { items: [toAdminRow(row)], count: 1 };
    }

    const result = await searchEntities({
      world_id,
      query,
      ...(type ? { type } : {}),
      ...(primary_component ? { primary_component } : {}),
      deleted,
      limit,
      offset,
      mode: "hybrid",
      projection: "list",
    });
    return { items: result.results.map(mapSearchHitToAdminRow), count: result.count };
  }

  const filterOpts = {
    world_id,
    deleted,
    ...(type ? { type } : {}),
    ...(primary_component ? { primary_component } : {}),
  };
  const [items, count] = await Promise.all([
    listEntities({
      ...filterOpts,
      order_by: deleted === "deleted" ? "deleted_at" : "updated_at",
      order_dir: "desc",
      limit,
      offset,
    }),
    countEntities(filterOpts),
  ]);
  return { items: items.map((row) => toAdminRow(row)), count };
}

export async function serviceEntityList(
  deps: RuntimeDeps,
  input: EntityAdminListInput | undefined,
  auth: VerifiedServiceApiToken,
) {
  return serviceEntityAdminList(deps, input, auth, "alive");
}

export async function serviceEntityTrashList(
  deps: RuntimeDeps,
  input: EntityAdminListInput | undefined,
  auth: VerifiedServiceApiToken,
) {
  return serviceEntityAdminList(deps, input, auth, "deleted");
}

export async function serviceEntityGet(
  deps: RuntimeDeps,
  input: { id: number; include_deleted?: boolean },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const row = await getEntity(input.id, { include_deleted: input.include_deleted === true });
  if (!row) {
    throw new Error("entity not found");
  }
  if (!isUserAgentPrivateWorldPassthrough(auth.subject_type, row.world_id)) {
    try {
      await assertSubjectCanAccessWorld(auth.subject_id, row.world_id, { access: "read" });
    } catch (e) {
      if (e instanceof ToolWorldAccessError) {
        throw new Error("entity not found", { cause: e });
      }
      throw e;
    }
  }
  return { item: toDetailRow(row) };
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

export async function serviceEntityAddComponent(
  deps: RuntimeDeps,
  input: {
    subject_kind?: SubjectKind;
    id: number;
    component: string;
    body?: Record<string, unknown>;
    promote_primary?: boolean;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const world_id = await entityWorldIdForAuth(auth, input.subject_kind);
  const existing = await assertEntityInWorld(input.id, world_id);
  assertAttachAllowed(existing, input.component);
  const row = await addEntityComponent({
    id: input.id,
    component: input.component,
    body: input.body ?? {},
    ...(input.promote_primary === true ? { promote_primary: true } : {}),
  });
  if (!row) throw new Error("entity not found");
  return { item: toAdminRow(row) };
}

export async function serviceEntitySetPrimaryComponent(
  deps: RuntimeDeps,
  input: { subject_kind?: SubjectKind; id: number; component: string },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const world_id = await entityWorldIdForAuth(auth, input.subject_kind);
  const existing = await assertEntityInWorld(input.id, world_id);
  assertPromoteAllowed(existing, input.component);
  const row = await promoteEntityComponent({ id: input.id, component: input.component });
  if (!row) throw new Error("entity not found");
  return { item: toAdminRow(row) };
}
