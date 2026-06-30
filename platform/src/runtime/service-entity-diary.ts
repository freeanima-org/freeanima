import {
  appendDiaryEntry,
  createDiaryEntry,
  deleteDiaryEntry,
  getDiaryEntry,
  listDiaryEntries,
  resolveDiaryWorldId,
  searchDiaryEntries,
  updateDiaryEntry,
  type DiarySubjectKind,
} from "@freeanima/capabilities-diary";

import { isPostgresPrimary } from "@freeanima/core/db/pg";
import { omitUndefined } from "@freeanima/core/util";
import type { RuntimeDeps } from "./runtime-deps.ts";

function assertPg(_deps: RuntimeDeps): void {
  if (!isPostgresPrimary()) {
    throw new Error("PostgreSQL unavailable");
  }
}

async function storeContext(_deps: RuntimeDeps, subjectKind: DiarySubjectKind) {
  const worldId = await resolveDiaryWorldId(subjectKind);
  return { worldId };
}

export async function serviceDiaryList(
  deps: RuntimeDeps,
  input: {
    subject_kind: DiarySubjectKind;
    entry_after?: string;
    entry_before?: string;
    tags?: string[];
    limit?: number;
    offset?: number;
  },
) {
  assertPg(deps);
  const ctx = await storeContext(deps, input.subject_kind);
  const items = await listDiaryEntries(
    ctx,
    omitUndefined({
      entry_after: input.entry_after,
      entry_before: input.entry_before,
      tags: input.tags,
      limit: input.limit,
      offset: input.offset,
    }),
  );
  return { items };
}

export async function serviceDiaryCreate(
  deps: RuntimeDeps,
  input: {
    subject_kind: DiarySubjectKind;
    title: string;
    content?: string;
    summary?: string;
    entry_at: string;
    tags?: string[];
  },
) {
  assertPg(deps);
  const ctx = await storeContext(deps, input.subject_kind);
  const item = await createDiaryEntry(ctx, input);
  return { item };
}

export async function serviceDiaryAppend(
  deps: RuntimeDeps,
  input: { subject_kind: DiarySubjectKind; id: number; content: string },
) {
  assertPg(deps);
  const ctx = await storeContext(deps, input.subject_kind);
  const item = await appendDiaryEntry(ctx, input);
  if (!item) throw new Error("NOT_FOUND");
  return { item };
}

export async function serviceDiaryPatch(
  deps: RuntimeDeps,
  input: {
    subject_kind: DiarySubjectKind;
    id: number;
    title?: string;
    content?: string;
    summary?: string;
    entry_at?: string;
    tags?: string[];
  },
) {
  assertPg(deps);
  const ctx = await storeContext(deps, input.subject_kind);
  const { id, subject_kind: _kind, ...patch } = input;
  const item = await updateDiaryEntry(ctx, { id, ...patch });
  if (!item) throw new Error("NOT_FOUND");
  return { item };
}

export async function serviceDiaryDelete(
  deps: RuntimeDeps,
  input: { subject_kind: DiarySubjectKind; id: number },
) {
  assertPg(deps);
  const ctx = await storeContext(deps, input.subject_kind);
  const ok = await deleteDiaryEntry(ctx, input.id);
  if (!ok) throw new Error("NOT_FOUND");
  return { ok: true as const };
}

export async function serviceDiaryGet(
  deps: RuntimeDeps,
  input: { subject_kind: DiarySubjectKind; id: number },
) {
  assertPg(deps);
  const ctx = await storeContext(deps, input.subject_kind);
  const item = await getDiaryEntry(ctx, input.id);
  if (!item) throw new Error("NOT_FOUND");
  return { item };
}

export async function serviceDiarySearch(
  deps: RuntimeDeps,
  input: {
    subject_kind: DiarySubjectKind;
    query: string;
    entry_after?: string;
    entry_before?: string;
    tags?: string[];
    limit?: number;
  },
) {
  assertPg(deps);
  const ctx = await storeContext(deps, input.subject_kind);
  const items = await searchDiaryEntries(ctx, input);
  return { items };
}
