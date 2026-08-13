import type { SubjectKind } from "@freeanima/host/core/config";
import { resolveSubjectWorldId } from "@freeanima/host/core/config/world-context";
import { isPostgresPrimary } from "@freeanima/host/core/db/pg";
import { omitUndefined } from "@freeanima/host/core/util";
import type { VerifiedServiceApiToken } from "@freeanima/host/core/db/pg/service-api-token";
import type { RpcRequestAuthContext } from "@freeanima/shared/rpc-contract";

import {
  createBookmark,
  deleteBookmark,
  getBookmark,
  listBookmarks,
  pullBookmarksSince,
  searchBookmarks,
  updateBookmark,
  upsertBookmarkBatch,
  type BookmarkKind,
  type BookmarkUpsertInput,
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

async function bookmarkWorldIdForAuth(
  auth: RpcRequestAuthContext,
  subject_kind?: SubjectKind,
): Promise<number> {
  const kind = resolveSubjectKind(subject_kind);
  assertSubjectKindMatches(auth, kind);
  return resolveSubjectWorldId(kind);
}

export async function serviceBookmarkList(
  deps: RuntimeDeps,
  input: {
    subject_kind: SubjectKind;
    parent_id?: number | null;
    kind?: BookmarkKind;
    limit?: number;
    offset?: number;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await bookmarkWorldIdForAuth(auth, input.subject_kind);
  const items = await listBookmarks(
    worldId,
    omitUndefined({
      parent_id: input.parent_id,
      kind: input.kind,
      limit: input.limit,
      offset: input.offset,
    }),
  );
  return { items };
}

export async function serviceBookmarkGet(
  deps: RuntimeDeps,
  input: { subject_kind: SubjectKind; id: number },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await bookmarkWorldIdForAuth(auth, input.subject_kind);
  const item = await getBookmark(worldId, input.id);
  if (!item) throw new Error("NOT_FOUND");
  return { item };
}

export async function serviceBookmarkSearch(
  deps: RuntimeDeps,
  input: {
    subject_kind: SubjectKind;
    query: string;
    limit?: number;
    offset?: number;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await bookmarkWorldIdForAuth(auth, input.subject_kind);
  return searchBookmarks(
    worldId,
    omitUndefined({
      query: input.query,
      limit: input.limit,
      offset: input.offset,
    }),
  );
}

export async function serviceBookmarkCreate(
  deps: RuntimeDeps,
  input: {
    subject_kind: SubjectKind;
    title: string;
    kind: BookmarkKind;
    url?: string | null;
    parent_id?: number | null;
    sort_order?: number;
    browser_id?: string | null;
    client_op_id?: string;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await bookmarkWorldIdForAuth(auth, input.subject_kind);
  const { subject_kind: _sk, ...rest } = input;
  const item = await createBookmark(worldId, omitUndefined(rest));
  return { item };
}

export async function serviceBookmarkPatch(
  deps: RuntimeDeps,
  input: {
    subject_kind: SubjectKind;
    id: number;
    title?: string;
    kind?: BookmarkKind;
    url?: string | null;
    parent_id?: number | null;
    sort_order?: number;
    browser_id?: string | null;
    client_op_id?: string;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await bookmarkWorldIdForAuth(auth, input.subject_kind);
  const { subject_kind: _sk, ...rest } = input;
  const item = await updateBookmark(worldId, omitUndefined(rest));
  if (!item) throw new Error("NOT_FOUND");
  return { item };
}

export async function serviceBookmarkDelete(
  deps: RuntimeDeps,
  input: { subject_kind: SubjectKind; id: number; client_op_id?: string },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await bookmarkWorldIdForAuth(auth, input.subject_kind);
  const ok = await deleteBookmark(worldId, input.id);
  if (!ok) throw new Error("NOT_FOUND");
  return { ok: true as const };
}

export async function serviceBookmarkUpsertBatch(
  deps: RuntimeDeps,
  input: {
    subject_kind: SubjectKind;
    items: BookmarkUpsertInput[];
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await bookmarkWorldIdForAuth(auth, input.subject_kind);
  const items = await upsertBookmarkBatch(worldId, input.items);
  return { items };
}

export async function serviceBookmarkSyncPull(
  deps: RuntimeDeps,
  input: {
    subject_kind: SubjectKind;
    updated_after?: string;
    limit?: number;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await bookmarkWorldIdForAuth(auth, input.subject_kind);
  const items = await pullBookmarksSince(
    worldId,
    omitUndefined({
      updated_after: input.updated_after,
      limit: input.limit,
    }),
  );
  return { items };
}
