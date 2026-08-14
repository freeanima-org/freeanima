import {
  appendNote,
  createNote,
  createNoteTextBlock,
  deleteNote,
  deleteNoteTextBlock,
  getNote,
  listNotes,
  reorderNoteTextBlocks,
  resolveNoteWorldId,
  searchNotes,
  updateNote,
  updateNoteTextBlock,
  type NoteSubjectKind,
} from "../domain/index.ts";

import { isPostgresPrimary } from "@freeanima/habitat/core/db/pg";
import { omitUndefined } from "@freeanima/habitat/core/util";
import type { RuntimeDeps } from "./runtime-deps.ts";

function assertPg(_deps: RuntimeDeps): void {
  if (!isPostgresPrimary()) {
    throw new Error("PostgreSQL unavailable");
  }
}

async function storeContext(_deps: RuntimeDeps, subjectKind: NoteSubjectKind) {
  const worldId = await resolveNoteWorldId(subjectKind);
  return { worldId };
}

export async function serviceNoteList(
  deps: RuntimeDeps,
  input: {
    subject_kind: NoteSubjectKind;
    tag_ids?: number[];
    limit?: number;
    offset?: number;
  },
) {
  assertPg(deps);
  const ctx = await storeContext(deps, input.subject_kind);
  const items = await listNotes(
    ctx,
    omitUndefined({
      tag_ids: input.tag_ids,
      limit: input.limit,
      offset: input.offset,
    }),
  );
  return { items };
}

export async function serviceNoteCreate(
  deps: RuntimeDeps,
  input: {
    subject_kind: NoteSubjectKind;
    title: string;
    content?: string;
    summary?: string;
    tags?: string[];
    tag_ids?: number[];
    client_op_id?: string;
  },
) {
  assertPg(deps);
  const ctx = await storeContext(deps, input.subject_kind);
  const item = await createNote(ctx, input);
  return { item };
}

export async function serviceNoteAppend(
  deps: RuntimeDeps,
  input: {
    subject_kind: NoteSubjectKind;
    id: number;
    content: string;
    client_op_id?: string;
  },
) {
  assertPg(deps);
  const ctx = await storeContext(deps, input.subject_kind);
  const item = await appendNote(ctx, input);
  if (!item) throw new Error("NOT_FOUND");
  return { item };
}

export async function serviceNotePatch(
  deps: RuntimeDeps,
  input: {
    subject_kind: NoteSubjectKind;
    id: number;
    title?: string;
    summary?: string;
    tags?: string[];
    tag_ids?: number[];
  },
) {
  assertPg(deps);
  const ctx = await storeContext(deps, input.subject_kind);
  const { id, subject_kind: _kind, ...patch } = input;
  const item = await updateNote(ctx, { id, ...patch });
  if (!item) throw new Error("NOT_FOUND");
  return { item };
}

export async function serviceNoteDelete(
  deps: RuntimeDeps,
  input: { subject_kind: NoteSubjectKind; id: number },
) {
  assertPg(deps);
  const ctx = await storeContext(deps, input.subject_kind);
  const ok = await deleteNote(ctx, input.id);
  if (!ok) throw new Error("NOT_FOUND");
  return { ok: true as const };
}

export async function serviceNoteGet(
  deps: RuntimeDeps,
  input: { subject_kind: NoteSubjectKind; id: number },
) {
  assertPg(deps);
  const ctx = await storeContext(deps, input.subject_kind);
  const item = await getNote(ctx, input.id);
  if (!item) throw new Error("NOT_FOUND");
  return { item };
}

export async function serviceNoteSearch(
  deps: RuntimeDeps,
  input: {
    subject_kind: NoteSubjectKind;
    query: string;
    tag_ids?: number[];
    limit?: number;
  },
) {
  assertPg(deps);
  const ctx = await storeContext(deps, input.subject_kind);
  const items = await searchNotes(ctx, input);
  return { items: items.map((item) => ({ ...item, blocks: [] as typeof item.blocks })) };
}

export async function serviceNoteBlockCreate(
  deps: RuntimeDeps,
  input: {
    subject_kind: NoteSubjectKind;
    parent_id: number;
    content: string;
    title?: string;
    tag_ids?: number[];
    components?: string[];
    sort_order?: number;
    client_op_id?: string;
  },
) {
  assertPg(deps);
  const ctx = await storeContext(deps, input.subject_kind);
  const item = await createNoteTextBlock(
    ctx,
    omitUndefined({
      parent_id: input.parent_id,
      content: input.content,
      title: input.title,
      tag_ids: input.tag_ids,
      components: input.components,
      sort_order: input.sort_order,
      client_op_id: input.client_op_id,
    }),
  );
  return { item };
}

export async function serviceNoteBlockPatch(
  deps: RuntimeDeps,
  input: {
    subject_kind: NoteSubjectKind;
    id: number;
    content?: string;
    title?: string;
    tag_ids?: number[];
    sort_order?: number;
  },
) {
  assertPg(deps);
  const ctx = await storeContext(deps, input.subject_kind);
  const item = await updateNoteTextBlock(
    ctx,
    omitUndefined({
      id: input.id,
      content: input.content,
      title: input.title,
      tag_ids: input.tag_ids,
      sort_order: input.sort_order,
    }),
  );
  if (!item) throw new Error("NOT_FOUND");
  return { item };
}

export async function serviceNoteBlockDelete(
  deps: RuntimeDeps,
  input: { subject_kind: NoteSubjectKind; id: number },
) {
  assertPg(deps);
  const ctx = await storeContext(deps, input.subject_kind);
  const ok = await deleteNoteTextBlock(ctx, input.id);
  if (!ok) throw new Error("NOT_FOUND");
  return { ok: true as const };
}

export async function serviceNoteBlockReorder(
  deps: RuntimeDeps,
  input: {
    subject_kind: NoteSubjectKind;
    items: Array<{ id: number; sort_order: number }>;
  },
) {
  assertPg(deps);
  const ctx = await storeContext(deps, input.subject_kind);
  const items = await reorderNoteTextBlocks(ctx, input.items);
  return { items };
}
