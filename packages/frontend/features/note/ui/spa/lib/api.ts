import { resolveHabitatCacheScope } from "@freeanima/client/portal-sdk/offline-cache";
import { withOfflineCache } from "@freeanima/client/portal-sdk/offline-cache-first";
import { getTypedHabitatClient } from "@freeanima/client/portal-sdk/habitat-typed-client.ts";
import { invalidatePortalReads } from "@freeanima/client/portal-sdk/portal-query";

import {
  findLocalNote,
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

let noteModuleRegistered = false;

function ensureNoteOfflineModule(): void {
  if (noteModuleRegistered) return;
  registerNoteOfflineModule();
  noteModuleRegistered = true;
}

function habitat() {
  return getTypedHabitatClient();
}

function listCacheId(subjectId: number, query?: string): string {
  const q = query?.trim();
  return q ? `search:${subjectId}:${q}` : `list:${subjectId}`;
}

function noteCacheId(subjectId: number, id: number): string {
  return `note:${subjectId}:${id}`;
}

export async function fetchNotes(
  subjectId: number,
  opts?: { limit?: number; offset?: number; tag_ids?: number[] },
): Promise<NoteRow[]> {
  ensureNoteOfflineModule();
  const scope = resolveHabitatCacheScope();
  return withOfflineCache({
    scope,
    namespace: "note",
    id: listCacheId(subjectId),
    fetch: async () => {
      const data = await habitat().call("note.list", {
        subject_id: subjectId,
        limit: opts?.limit ?? 50,
        offset: opts?.offset ?? 0,
        ...(opts?.tag_ids?.length ? { tag_ids: opts.tag_ids } : {}),
      });
      return data.items;
    },
    reconcile: (items) => reconcileServerNoteList(subjectId, items),
    offlineError: "note.list unavailable offline",
  });
}

export async function searchNotes(
  subjectId: number,
  query: string,
  limit?: number,
): Promise<NoteRow[]> {
  ensureNoteOfflineModule();
  const scope = resolveHabitatCacheScope();
  return withOfflineCache({
    scope,
    namespace: "note",
    id: listCacheId(subjectId, query),
    fetch: async () => {
      const data = await habitat().call("note.search", {
        subject_id: subjectId,
        query,
        limit,
      });
      return data.items;
    },
    offlineError: "note.search unavailable offline",
  });
}

export async function getNote(subjectId: number, id: number): Promise<NoteRow> {
  ensureNoteOfflineModule();
  const scope = resolveHabitatCacheScope();
  try {
    return await withOfflineCache({
      scope,
      namespace: "note",
      id: noteCacheId(subjectId, id),
      fetch: async () => {
        const data = await habitat().call("note.get", { subject_id: subjectId, id });
        return data.item;
      },
      offlineError: "note.get unavailable offline",
    });
  } catch (err) {
    const local = await findLocalNote(scope, subjectId, id);
    if (local) return local;
    throw err;
  }
}

export async function createNote(
  subjectId: number,
  input: { title: string; content?: string; summary?: string; tag_ids?: number[] },
): Promise<NoteRow> {
  ensureNoteOfflineModule();
  const item = await offlineCreateNote(subjectId, input);
  await invalidatePortalReads(["note"]);
  return item;
}

export async function updateNote(
  subjectId: number,
  id: number,
  patch: { title?: string; summary?: string; tag_ids?: number[] },
): Promise<NoteRow> {
  ensureNoteOfflineModule();
  const item = await offlineUpdateNote(subjectId, id, patch);
  await invalidatePortalReads(["note"]);
  return item;
}

export async function deleteNote(subjectId: number, id: number): Promise<void> {
  ensureNoteOfflineModule();
  await offlineDeleteNote(subjectId, id);
  await invalidatePortalReads(["note"]);
}

export async function createNoteBlock(
  subjectId: number,
  parentId: number,
  content: string,
): Promise<NoteTextBlock> {
  ensureNoteOfflineModule();
  const item = await offlineCreateNoteBlock(subjectId, parentId, content);
  await invalidatePortalReads(["note"]);
  return item;
}

export async function updateNoteBlock(
  subjectId: number,
  id: number,
  patch: { content?: string; title?: string },
): Promise<NoteTextBlock> {
  ensureNoteOfflineModule();
  const item = await offlineUpdateNoteBlock(subjectId, id, patch);
  await invalidatePortalReads(["note"]);
  return item;
}

export async function deleteNoteBlock(subjectId: number, id: number): Promise<void> {
  ensureNoteOfflineModule();
  await offlineDeleteNoteBlock(subjectId, id);
  await invalidatePortalReads(["note"]);
}

export { countNotePendingOps, registerNoteOfflineModule } from "./offline-store.ts";
