import { resolvePrivateWorldId } from "@freeanima/habitat/core/config/world-context-pg";
import { isPostgresPrimary } from "@freeanima/habitat/core/db/pg";
import { omitUndefined } from "@freeanima/habitat/core/util";
import type { VerifiedServiceApiToken } from "@freeanima/habitat/core/db/pg/service-api-token";
import type { RpcRequestAuthContext } from "@freeanima/shared/rpc-contract";

import {
  createTag,
  deleteTag,
  listTags,
  searchTags,
  setEntityTagIds,
  suggestTags,
  updateTag,
} from "../domain/index.ts";
import type { RuntimeDeps } from "./runtime-deps.ts";

function assertPg(_deps: RuntimeDeps): void {
  if (!isPostgresPrimary()) {
    throw new Error("PostgreSQL unavailable");
  }
}

function assertSubjectIdAllowed(auth: RpcRequestAuthContext, subjectId: number): void {
  if (auth.subject_id === subjectId) return;
  if (auth.subject_type === "user") return;
  throw new Error("FORBIDDEN_SUBJECT");
}

function requireSubjectId(subject_id: number | undefined): number {
  if (subject_id == null || !Number.isInteger(subject_id) || subject_id <= 0) {
    throw new Error("subject_id is required");
  }
  return subject_id;
}

async function tagWorldIdForAuth(
  auth: RpcRequestAuthContext,
  subject_id: number | undefined,
): Promise<number> {
  const subjectId = requireSubjectId(subject_id);
  assertSubjectIdAllowed(auth, subjectId);
  return resolvePrivateWorldId(subjectId);
}

export async function serviceTagList(
  deps: RuntimeDeps,
  input: { subject_id?: number } | undefined,
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const tags = await listTags(await tagWorldIdForAuth(auth, input?.subject_id));
  return { tags };
}

export async function serviceTagSearch(
  deps: RuntimeDeps,
  input: {
    subject_id?: number;
    query?: string;
    limit?: number;
    offset?: number;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const { subject_id, ...opts } = input;
  return searchTags(await tagWorldIdForAuth(auth, subject_id), omitUndefined(opts));
}

export async function serviceTagSuggest(
  deps: RuntimeDeps,
  input: {
    subject_id?: number;
    primary_component: string;
    query?: string;
    limit?: number;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const { subject_id, primary_component, ...opts } = input;
  const items = await suggestTags(
    await tagWorldIdForAuth(auth, subject_id),
    primary_component,
    omitUndefined(opts),
  );
  return { items };
}

export async function serviceTagCreate(
  deps: RuntimeDeps,
  input: {
    subject_id?: number;
    title: string;
    sort_order?: number;
    client_op_id?: string;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const { subject_id, ...createInput } = input;
  const item = await createTag(await tagWorldIdForAuth(auth, subject_id), createInput);
  return { item };
}

export async function serviceTagPatch(
  deps: RuntimeDeps,
  input: {
    subject_id?: number;
    id: number;
    title?: string;
    sort_order?: number;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const { subject_id, id, ...patch } = input;
  const item = await updateTag(
    await tagWorldIdForAuth(auth, subject_id),
    omitUndefined({ id, ...patch }),
  );
  if (!item) throw new Error("tag not found");
  return { item };
}

export async function serviceTagDelete(
  deps: RuntimeDeps,
  input: { subject_id?: number; id: number },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const ok = await deleteTag(await tagWorldIdForAuth(auth, input.subject_id), input.id);
  if (!ok) throw new Error("tag not found");
  return { ok: true as const };
}

export async function serviceTagSetOnEntity(
  deps: RuntimeDeps,
  input: {
    subject_id?: number;
    entity_id: number;
    tag_ids: number[];
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  return setEntityTagIds(
    await tagWorldIdForAuth(auth, input.subject_id),
    input.entity_id,
    input.tag_ids,
  );
}
