import type { SubjectKind } from "@freeanima/host/core/config";
import { resolveSubjectWorldId } from "@freeanima/host/core/config/world-context";
import { isPostgresPrimary } from "@freeanima/host/core/db/pg";
import { omitUndefined } from "@freeanima/host/core/util";
import type { VerifiedServiceApiToken } from "@freeanima/host/core/db/pg/service-api-token";
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

async function tagWorldIdForAuth(
  auth: RpcRequestAuthContext,
  subject_kind?: SubjectKind,
): Promise<number> {
  const kind = resolveSubjectKind(subject_kind);
  assertSubjectKindMatches(auth, kind);
  return resolveSubjectWorldId(kind);
}

export async function serviceTagList(
  deps: RuntimeDeps,
  input: { subject_kind?: SubjectKind } | undefined,
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const tags = await listTags(await tagWorldIdForAuth(auth, input?.subject_kind));
  return { tags };
}

export async function serviceTagSearch(
  deps: RuntimeDeps,
  input: {
    subject_kind?: SubjectKind;
    query?: string;
    limit?: number;
    offset?: number;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const { subject_kind, ...opts } = input;
  return searchTags(await tagWorldIdForAuth(auth, subject_kind), omitUndefined(opts));
}

export async function serviceTagSuggest(
  deps: RuntimeDeps,
  input: {
    subject_kind?: SubjectKind;
    primary_component: string;
    query?: string;
    limit?: number;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const { subject_kind, primary_component, ...opts } = input;
  const items = await suggestTags(
    await tagWorldIdForAuth(auth, subject_kind),
    primary_component,
    omitUndefined(opts),
  );
  return { items };
}

export async function serviceTagCreate(
  deps: RuntimeDeps,
  input: {
    subject_kind?: SubjectKind;
    title: string;
    sort_order?: number;
    client_op_id?: string;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const { subject_kind, ...createInput } = input;
  const item = await createTag(await tagWorldIdForAuth(auth, subject_kind), createInput);
  return { item };
}

export async function serviceTagPatch(
  deps: RuntimeDeps,
  input: {
    subject_kind?: SubjectKind;
    id: number;
    title?: string;
    sort_order?: number;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const { subject_kind, id, ...patch } = input;
  const item = await updateTag(
    await tagWorldIdForAuth(auth, subject_kind),
    omitUndefined({ id, ...patch }),
  );
  if (!item) throw new Error("tag not found");
  return { item };
}

export async function serviceTagDelete(
  deps: RuntimeDeps,
  input: { subject_kind?: SubjectKind; id: number },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const ok = await deleteTag(await tagWorldIdForAuth(auth, input.subject_kind), input.id);
  if (!ok) throw new Error("tag not found");
  return { ok: true as const };
}

export async function serviceTagSetOnEntity(
  deps: RuntimeDeps,
  input: {
    subject_kind?: SubjectKind;
    entity_id: number;
    tag_ids: number[];
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  return setEntityTagIds(
    await tagWorldIdForAuth(auth, input.subject_kind),
    input.entity_id,
    input.tag_ids,
  );
}
