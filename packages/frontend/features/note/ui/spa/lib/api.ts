import type { SubjectKind } from "@freeanima/client/portal-sdk";
import { resolveHabitatCacheScope } from "@freeanima/client/portal-sdk/offline-cache";
import { withOfflineCache } from "@freeanima/client/portal-sdk/offline-cache-first";
import { getTypedHabitatClient } from "@freeanima/client/portal-sdk/habitat-typed-client.ts";
import { invalidatePortalReads } from "@freeanima/client/portal-sdk/portal-query";

import {
  offlineCreateNote,
  offlineCreateNoteBlock,
  offlineDeleteNote,
  offlineDeleteNoteBlock,
  offlineUpdateNote,
  offlineUpdateNoteBlock,
  reconcileServerNoteList,
  registerNoteOfflineModule,
  type NoteRow,
  type NoteTextBlock,
} from "./offline-store.ts";

export type { NoteRow, NoteTextBlock };
export type NoteSubjectKind = SubjectKind;

let noteModuleRegistered = false;

function ensureNoteOfflineModule(): void {
  if (noteModuleRegistered) return;
  registerNoteOfflineModule();
  noteModuleRegistered = true;
}

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
  ensureNoteOfflineModule();
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
    reconcile: (items) => reconcileServerNoteList(subjectKind, items),
    offlineError: "note.list unavailable offline",
  });
}

export async function searchNotes(
  subjectKind: NoteSubjectKind,
  query: string,
  limit?: number,
): Promise<NoteRow[]> {
  ensureNoteOfflineModule();
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
  ensureNoteOfflineModule();
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
  ensureNoteOfflineModule();
  const item = await offlineCreateNote(subjectKind, input);
  await invalidatePortalReads(["note"]);
  return item;
}

export async function updateNote(
  subjectKind: NoteSubjectKind,
  id: number,
  patch: { title?: string; summary?: string; tag_ids?: number[] },
): Promise<NoteRow> {
  ensureNoteOfflineModule();
  const item = await offlineUpdateNote(subjectKind, id, patch);
  await invalidatePortalReads(["note"]);
  return item;
}

export async function deleteNote(subjectKind: NoteSubjectKind, id: number): Promise<void> {
  ensureNoteOfflineModule();
  await offlineDeleteNote(subjectKind, id);
  await invalidatePortalReads(["note"]);
}

export async function createNoteBlock(
  subjectKind: NoteSubjectKind,
  parentId: number,
  content: string,
): Promise<NoteTextBlock> {
  ensureNoteOfflineModule();
  const item = await offlineCreateNoteBlock(subjectKind, parentId, content);
  await invalidatePortalReads(["note"]);
  return item;
}

export async function updateNoteBlock(
  subjectKind: NoteSubjectKind,
  id: number,
  patch: { content?: string; title?: string },
): Promise<NoteTextBlock> {
  ensureNoteOfflineModule();
  const item = await offlineUpdateNoteBlock(subjectKind, id, patch);
  await invalidatePortalReads(["note"]);
  return item;
}

export async function deleteNoteBlock(subjectKind: NoteSubjectKind, id: number): Promise<void> {
  ensureNoteOfflineModule();
  await offlineDeleteNoteBlock(subjectKind, id);
  await invalidatePortalReads(["note"]);
}

export { countNotePendingOps, registerNoteOfflineModule } from "./offline-store.ts";
