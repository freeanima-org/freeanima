import { resolvePrivateWorldId } from "@freeanima/habitat/core/config/world-context-pg";
import { isPostgresPrimary } from "@freeanima/habitat/core/db/pg";
import { omitUndefined } from "@freeanima/habitat/core/util";
import type { VerifiedServiceApiToken } from "@freeanima/habitat/core/db/pg/service-api-token";
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

async function bookmarkWorldIdForAuth(
  auth: RpcRequestAuthContext,
  subject_id: number | undefined,
): Promise<number> {
  const subjectId = requireSubjectId(subject_id);
  assertSubjectIdAllowed(auth, subjectId);
  return resolvePrivateWorldId(subjectId);
}

export async function serviceBookmarkList(
  deps: RuntimeDeps,
  input: {
    subject_id: number;
    parent_id?: number | null;
    kind?: BookmarkKind;
    limit?: number;
    offset?: number;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await bookmarkWorldIdForAuth(auth, input.subject_id);
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
  input: { subject_id: number; id: number },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await bookmarkWorldIdForAuth(auth, input.subject_id);
  const item = await getBookmark(worldId, input.id);
  if (!item) throw new Error("NOT_FOUND");
  return { item };
}

export async function serviceBookmarkSearch(
  deps: RuntimeDeps,
  input: {
    subject_id: number;
    query: string;
    limit?: number;
    offset?: number;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await bookmarkWorldIdForAuth(auth, input.subject_id);
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
    subject_id: number;
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
  const worldId = await bookmarkWorldIdForAuth(auth, input.subject_id);
  const { subject_id: _sid, ...rest } = input;
  const item = await createBookmark(worldId, omitUndefined(rest));
  return { item };
}

export async function serviceBookmarkPatch(
  deps: RuntimeDeps,
  input: {
    subject_id: number;
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
  const worldId = await bookmarkWorldIdForAuth(auth, input.subject_id);
  const { subject_id: _sid, ...rest } = input;
  const item = await updateBookmark(worldId, omitUndefined(rest));
  if (!item) throw new Error("NOT_FOUND");
  return { item };
}

export async function serviceBookmarkDelete(
  deps: RuntimeDeps,
  input: { subject_id: number; id: number; client_op_id?: string },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await bookmarkWorldIdForAuth(auth, input.subject_id);
  const ok = await deleteBookmark(worldId, input.id);
  if (!ok) throw new Error("NOT_FOUND");
  return { ok: true as const };
}

export async function serviceBookmarkUpsertBatch(
  deps: RuntimeDeps,
  input: {
    subject_id: number;
    items: BookmarkUpsertInput[];
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await bookmarkWorldIdForAuth(auth, input.subject_id);
  const items = await upsertBookmarkBatch(worldId, input.items);
  return { items };
}

export async function serviceBookmarkSyncPull(
  deps: RuntimeDeps,
  input: {
    subject_id: number;
    updated_after?: string;
    limit?: number;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await bookmarkWorldIdForAuth(auth, input.subject_id);
  const items = await pullBookmarksSince(
    worldId,
    omitUndefined({
      updated_after: input.updated_after,
      limit: input.limit,
    }),
  );
  return { items };
}
