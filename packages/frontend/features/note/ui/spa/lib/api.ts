import type {
  NoteRowPayload,
  NoteTextBlockPayload,
} from "@freeanima/shared/rpc-contract/frames/note.ts";
import type { SubjectKind } from "@freeanima/client/portal-sdk";
import { resolveHabitatCacheScope } from "@freeanima/client/portal-sdk/offline-cache";
import { withOfflineCache } from "@freeanima/client/portal-sdk/offline-cache-first";
import { getTypedHabitatClient } from "@freeanima/client/portal-sdk/habitat-typed-client.ts";
import { invalidatePortalReads } from "@freeanima/client/portal-sdk/portal-query";
import { randomUuid } from "@freeanima/shared/rpc-contract";

export type NoteRow = NoteRowPayload;
export type NoteTextBlock = NoteTextBlockPayload;
export type NoteSubjectKind = SubjectKind;

function habitat() {
  return getTypedHabitatClient();
}

function listCacheId(subjectKind: NoteSubjectKind, query?: string): string {
  const q = query?.trim();
  return q ? `search:${subjectKind}:${q}` : `list:${subjectKind}`;
}

function noteCacheId(subjectKind: NoteSubjectKind, id: number): string {
  return `note:${subjectKind}:${id}`;
}

export async function fetchNotes(
  subjectKind: NoteSubjectKind,
  opts?: { limit?: number; offset?: number; tag_ids?: number[] },
): Promise<NoteRow[]> {
  const scope = resolveHabitatCacheScope();
  return withOfflineCache({
    scope,
    namespace: "note",
    id: listCacheId(subjectKind),
    fetch: async () => {
      const data = await habitat().call("note.list", {
        subject_kind: subjectKind,
        limit: opts?.limit ?? 50,
        offset: opts?.offset ?? 0,
        ...(opts?.tag_ids?.length ? { tag_ids: opts.tag_ids } : {}),
      });
      return data.items;
    },
    offlineError: "note.list unavailable offline",
  });
}

export async function searchNotes(
  subjectKind: NoteSubjectKind,
  query: string,
  limit?: number,
): Promise<NoteRow[]> {
  const scope = resolveHabitatCacheScope();
  return withOfflineCache({
    scope,
    namespace: "note",
    id: listCacheId(subjectKind, query),
    fetch: async () => {
      const data = await habitat().call("note.search", {
        subject_kind: subjectKind,
        query,
        limit,
      });
      return data.items;
    },
    offlineError: "note.search unavailable offline",
  });
}

export async function getNote(subjectKind: NoteSubjectKind, id: number): Promise<NoteRow> {
  const scope = resolveHabitatCacheScope();
  return withOfflineCache({
    scope,
    namespace: "note",
    id: noteCacheId(subjectKind, id),
    fetch: async () => {
      const data = await habitat().call("note.get", { subject_kind: subjectKind, id });
      return data.item;
    },
    offlineError: "note.get unavailable offline",
  });
}

export async function createNote(
  subjectKind: NoteSubjectKind,
  input: { title: string; content?: string; summary?: string; tag_ids?: number[] },
): Promise<NoteRow> {
  const data = await habitat().call("note.create", {
    subject_kind: subjectKind,
    title: input.title,
    content: input.content,
    summary: input.summary,
    tag_ids: input.tag_ids,
    client_op_id: randomUuid(),
  });
  await invalidatePortalReads(["note"]);
  return data.item;
}

export async function updateNote(
  subjectKind: NoteSubjectKind,
  id: number,
  patch: { title?: string; summary?: string; tag_ids?: number[] },
): Promise<NoteRow> {
  const data = await habitat().call("note.patch", {
    subject_kind: subjectKind,
    id,
    ...patch,
  });
  await invalidatePortalReads(["note"]);
  return data.item;
}

export async function deleteNote(subjectKind: NoteSubjectKind, id: number): Promise<void> {
  await habitat().call("note.delete", { subject_kind: subjectKind, id });
  await invalidatePortalReads(["note"]);
}

export async function createNoteBlock(
  subjectKind: NoteSubjectKind,
  parentId: number,
  content: string,
): Promise<NoteTextBlock> {
  const data = await habitat().call("note.blockCreate", {
    subject_kind: subjectKind,
    parent_id: parentId,
    content,
    client_op_id: randomUuid(),
  });
  await invalidatePortalReads(["note"]);
  return data.item;
}

export async function updateNoteBlock(
  subjectKind: NoteSubjectKind,
  id: number,
  patch: { content?: string; title?: string },
): Promise<NoteTextBlock> {
  const data = await habitat().call("note.blockPatch", {
    subject_kind: subjectKind,
    id,
    ...patch,
  });
  await invalidatePortalReads(["note"]);
  return data.item;
}

export async function deleteNoteBlock(subjectKind: NoteSubjectKind, id: number): Promise<void> {
  await habitat().call("note.blockDelete", { subject_kind: subjectKind, id });
  await invalidatePortalReads(["note"]);
}
