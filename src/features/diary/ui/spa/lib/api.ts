import type { DiaryEntryRow, DiarySubjectKind } from "./format-diary.ts";
import {
  readOfflineCache,
  resolveHubCacheScope,
  writeOfflineCache,
} from "@freeanima/frontend/shell-sdk/offline-cache";
import { withOfflineCache } from "@freeanima/frontend/shell-sdk/offline-cache-first";
import { isHubFetchAvailable } from "@freeanima/frontend/shell-sdk/hub-fetch-gate";
import { getTypedSatelliteHubClient } from "@freeanima/platform/hub";

import {
  offlineAppendDiaryEntry,
  offlineCreateDiaryEntry,
  offlineDeleteDiaryEntry,
  offlineUpdateDiaryEntry,
  registerDiaryOfflineModule,
} from "./offline-store.ts";

let diaryModuleRegistered = false;

function ensureDiaryOfflineModule(): void {
  if (diaryModuleRegistered) return;
  registerDiaryOfflineModule();
  diaryModuleRegistered = true;
}

function hub() {
  return getTypedSatelliteHubClient();
}

function diaryListCacheId(subjectKind: DiarySubjectKind, query?: string): string {
  const q = query?.trim();
  return q ? `search:${subjectKind}:${q}` : `list:${subjectKind}`;
}

function diaryEntryCacheId(subjectKind: DiarySubjectKind, id: number): string {
  return `entry:${subjectKind}:${id}`;
}

export async function fetchDiaryEntries(
  subjectKind: DiarySubjectKind,
  opts?: { limit?: number },
): Promise<DiaryEntryRow[]> {
  const scope = resolveHubCacheScope();
  const cacheId = diaryListCacheId(subjectKind);
  return withOfflineCache({
    scope,
    namespace: "diary",
    id: cacheId,
    fetch: async () => {
      const data = await hub().call("diary.list", {
        subject_kind: subjectKind,
        limit: opts?.limit ?? 200,
      });
      return data.items;
    },
    offlineError: "diary.list unavailable offline",
  });
}

export async function searchDiaryEntries(
  subjectKind: DiarySubjectKind,
  query: string,
  limit?: number,
): Promise<DiaryEntryRow[]> {
  const scope = resolveHubCacheScope();
  const cacheId = diaryListCacheId(subjectKind, query);
  return withOfflineCache({
    scope,
    namespace: "diary",
    id: cacheId,
    fetch: async () => {
      const data = await hub().call("diary.search", {
        subject_kind: subjectKind,
        query,
        limit,
      });
      return data.items;
    },
    offlineError: "diary.search unavailable offline",
  });
}

export async function getDiaryEntry(
  subjectKind: DiarySubjectKind,
  id: number,
): Promise<DiaryEntryRow> {
  const scope = resolveHubCacheScope();
  const cacheId = diaryEntryCacheId(subjectKind, id);
  const cached = await readOfflineCache<DiaryEntryRow>(scope, "diary", cacheId);
  if (cached) return cached;
  if (!isHubFetchAvailable()) {
    throw new Error("diary.get unavailable offline");
  }
  const data = await hub().call("diary.get", { subject_kind: subjectKind, id });
  void writeOfflineCache(scope, "diary", cacheId, data.item);
  return data.item;
}

export async function createDiaryEntry(
  subjectKind: DiarySubjectKind,
  input: {
    title: string;
    content?: string;
    summary?: string;
    entry_at: string;
    tags?: string[];
  },
): Promise<DiaryEntryRow> {
  ensureDiaryOfflineModule();
  return offlineCreateDiaryEntry(subjectKind, input);
}

export async function appendDiaryEntry(
  subjectKind: DiarySubjectKind,
  id: number,
  content: string,
): Promise<DiaryEntryRow> {
  ensureDiaryOfflineModule();
  return offlineAppendDiaryEntry(subjectKind, id, content);
}

export async function updateDiaryEntry(
  subjectKind: DiarySubjectKind,
  id: number,
  patch: Partial<Pick<DiaryEntryRow, "title" | "content" | "summary" | "entry_at" | "tags">>,
): Promise<DiaryEntryRow> {
  ensureDiaryOfflineModule();
  return offlineUpdateDiaryEntry(subjectKind, id, patch);
}

export async function deleteDiaryEntry(subjectKind: DiarySubjectKind, id: number): Promise<void> {
  ensureDiaryOfflineModule();
  return offlineDeleteDiaryEntry(subjectKind, id);
}

export { countDiaryPendingOps } from "./offline-store.ts";
