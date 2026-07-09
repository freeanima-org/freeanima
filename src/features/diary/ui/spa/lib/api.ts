import type { DiaryEntryRow, DiarySubjectKind } from "./format-diary.ts";
import {
  readOfflineCache,
  resolveHubCacheScope,
  writeOfflineCache,
} from "@freeanima/frontend/shell-sdk/offline-cache";
import { getDiaryHubClient } from "./hub-client.ts";

function hub() {
  return getDiaryHubClient();
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
  const cached = await readOfflineCache<DiaryEntryRow[]>(scope, "diary", cacheId);
  try {
    const data = await hub().call("diary.list", {
      subject_kind: subjectKind,
      limit: opts?.limit ?? 200,
    });
    void writeOfflineCache(scope, "diary", cacheId, data.items);
    return data.items;
  } catch (err) {
    if (cached) return cached;
    throw err;
  }
}

export async function searchDiaryEntries(
  subjectKind: DiarySubjectKind,
  query: string,
  limit?: number,
): Promise<DiaryEntryRow[]> {
  const scope = resolveHubCacheScope();
  const cacheId = diaryListCacheId(subjectKind, query);
  const cached = await readOfflineCache<DiaryEntryRow[]>(scope, "diary", cacheId);
  try {
    const data = await hub().call("diary.search", {
      subject_kind: subjectKind,
      query,
      limit,
    });
    void writeOfflineCache(scope, "diary", cacheId, data.items);
    return data.items;
  } catch (err) {
    if (cached) return cached;
    throw err;
  }
}

export async function getDiaryEntry(
  subjectKind: DiarySubjectKind,
  id: number,
): Promise<DiaryEntryRow> {
  const scope = resolveHubCacheScope();
  const cacheId = diaryEntryCacheId(subjectKind, id);
  const cached = await readOfflineCache<DiaryEntryRow>(scope, "diary", cacheId);
  try {
    const data = await hub().call("diary.get", { subject_kind: subjectKind, id });
    void writeOfflineCache(scope, "diary", cacheId, data.item);
    return data.item;
  } catch (err) {
    if (cached) return cached;
    throw err;
  }
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
  const data = await hub().call("diary.create", { subject_kind: subjectKind, ...input });
  return data.item;
}

export async function appendDiaryEntry(
  subjectKind: DiarySubjectKind,
  id: number,
  content: string,
): Promise<DiaryEntryRow> {
  const data = await hub().call("diary.append", { subject_kind: subjectKind, id, content });
  return data.item;
}

export async function updateDiaryEntry(
  subjectKind: DiarySubjectKind,
  id: number,
  patch: Partial<Pick<DiaryEntryRow, "title" | "content" | "summary" | "entry_at" | "tags">>,
): Promise<DiaryEntryRow> {
  const data = await hub().call("diary.patch", { subject_kind: subjectKind, id, ...patch });
  return data.item;
}

export async function deleteDiaryEntry(subjectKind: DiarySubjectKind, id: number): Promise<void> {
  await hub().call("diary.delete", { subject_kind: subjectKind, id });
}
