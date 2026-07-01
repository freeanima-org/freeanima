import type { DiaryEntryRow, DiarySubjectKind } from "./format-diary.ts";
import {
  readOfflineCache,
  resolveHubCacheScope,
  writeOfflineCache,
} from "@freeanima/shell-sdk/offline-cache";
import { whenSapClientReady } from "./hub-rpc.ts";

async function sap() {
  return whenSapClientReady();
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
    const client = await sap();
    const data = await client.request("diary.list", {
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
    const client = await sap();
    const data = await client.request("diary.search", {
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
    const client = await sap();
    const data = await client.request("diary.get", { subject_kind: subjectKind, id });
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
  const client = await sap();
  const data = await client.request("diary.create", { subject_kind: subjectKind, ...input });
  return data.item;
}

export async function appendDiaryEntry(
  subjectKind: DiarySubjectKind,
  id: number,
  content: string,
): Promise<DiaryEntryRow> {
  const client = await sap();
  const data = await client.request("diary.append", { subject_kind: subjectKind, id, content });
  return data.item;
}

export async function updateDiaryEntry(
  subjectKind: DiarySubjectKind,
  id: number,
  patch: Partial<Pick<DiaryEntryRow, "title" | "content" | "summary" | "entry_at" | "tags">>,
): Promise<DiaryEntryRow> {
  const client = await sap();
  const data = await client.request("diary.patch", { subject_kind: subjectKind, id, ...patch });
  return data.item;
}

export async function deleteDiaryEntry(subjectKind: DiarySubjectKind, id: number): Promise<void> {
  const client = await sap();
  await client.request("diary.delete", { subject_kind: subjectKind, id });
}
