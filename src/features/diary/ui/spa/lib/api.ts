import type { DiaryEntryRow, DiarySubjectKind, DiaryTextBlock } from "./format-diary.ts";
export type { DiarySubjectKind };
import { resolveHabitatCacheScope } from "@freeanima/frontend/portal-sdk/offline-cache";
import { withOfflineCache } from "@freeanima/frontend/portal-sdk/offline-cache-first";
import { getTypedHabitatClient } from "@freeanima/platform/habitat/client.ts";

import {
  offlineAppendDiaryEntry,
  offlineCreateDiaryBlock,
  offlineCreateDiaryEntry,
  offlineDeleteDiaryBlock,
  offlineDeleteDiaryEntry,
  offlineReorderDiaryBlocks,
  offlineUpdateDiaryBlock,
  offlineUpdateDiaryEntry,
  reconcileServerDiaryList,
  registerDiaryOfflineModule,
} from "./offline-store.ts";

let diaryModuleRegistered = false;

function ensureDiaryOfflineModule(): void {
  if (diaryModuleRegistered) return;
  registerDiaryOfflineModule();
  diaryModuleRegistered = true;
}

function habitat() {
  return getTypedHabitatClient();
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
  opts?: { limit?: number; offset?: number },
): Promise<DiaryEntryRow[]> {
  const limit = opts?.limit ?? 20;
  const offset = opts?.offset ?? 0;

  // 分页后续页不走 list cache，避免把「仅首屏」写成「全量」
  if (offset > 0) {
    const data = await habitat().call("diary.list", {
      subject_kind: subjectKind,
      limit,
      offset,
    });
    return data.items;
  }

  const scope = resolveHabitatCacheScope();
  const cacheId = diaryListCacheId(subjectKind);
  return withOfflineCache({
    scope,
    namespace: "diary",
    id: cacheId,
    fetch: async () => {
      const data = await habitat().call("diary.list", {
        subject_kind: subjectKind,
        limit,
        offset: 0,
      });
      return data.items;
    },
    reconcile: (items) => reconcileServerDiaryList(subjectKind, items),
    offlineError: "diary.list unavailable offline",
  });
}

export async function searchDiaryEntries(
  subjectKind: DiarySubjectKind,
  query: string,
  limit?: number,
): Promise<DiaryEntryRow[]> {
  const scope = resolveHabitatCacheScope();
  const cacheId = diaryListCacheId(subjectKind, query);
  return withOfflineCache({
    scope,
    namespace: "diary",
    id: cacheId,
    fetch: async () => {
      const data = await habitat().call("diary.search", {
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
  const scope = resolveHabitatCacheScope();
  const cacheId = diaryEntryCacheId(subjectKind, id);
  return withOfflineCache({
    scope,
    namespace: "diary",
    id: cacheId,
    fetch: async () => {
      const data = await habitat().call("diary.get", { subject_kind: subjectKind, id });
      return data.item;
    },
    offlineError: "diary.get unavailable offline",
  });
}

export async function createDiaryEntry(
  subjectKind: DiarySubjectKind,
  input: {
    title: string;
    content?: string;
    summary?: string;
    entry_at: string;
    tags?: string[];
    tag_ids?: number[];
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
  patch: Partial<Pick<DiaryEntryRow, "title" | "summary" | "entry_at" | "tag_ids">> & {
    tags?: string[];
  },
): Promise<DiaryEntryRow> {
  ensureDiaryOfflineModule();
  return offlineUpdateDiaryEntry(subjectKind, id, patch);
}

export async function deleteDiaryEntry(subjectKind: DiarySubjectKind, id: number): Promise<void> {
  ensureDiaryOfflineModule();
  return offlineDeleteDiaryEntry(subjectKind, id);
}

export async function createDiaryBlock(
  subjectKind: DiarySubjectKind,
  parentId: number,
  input: {
    content: string;
    title?: string;
    tag_ids?: number[];
    components?: string[];
    sort_order?: number;
  },
): Promise<DiaryTextBlock> {
  ensureDiaryOfflineModule();
  return offlineCreateDiaryBlock(subjectKind, parentId, input);
}

export async function updateDiaryBlock(
  subjectKind: DiarySubjectKind,
  id: number,
  patch: { content?: string; title?: string; tag_ids?: number[]; sort_order?: number },
): Promise<DiaryTextBlock> {
  ensureDiaryOfflineModule();
  return offlineUpdateDiaryBlock(subjectKind, id, patch);
}

export type DiaryBlockTemplateRow = {
  id: number;
  name: string;
  sort_order: number;
  preset: {
    title: string;
    content: string;
    components: string[];
    tag_ids: number[];
  };
  created_at: string;
  updated_at: string;
};

export async function fetchDiaryBlockTemplates(
  subjectKind: DiarySubjectKind,
): Promise<DiaryBlockTemplateRow[]> {
  const data = await habitat().call("diary.templateList", { subject_kind: subjectKind });
  return data.items;
}

export async function suggestDiaryTags(
  subjectKind: DiarySubjectKind,
  opts?: { query?: string; limit?: number },
): Promise<Array<{ id: number; title: string; count: number }>> {
  const data = await habitat().call("diary.suggestTags", {
    subject_kind: subjectKind,
    ...(opts?.query != null && opts.query !== "" ? { query: opts.query } : {}),
    limit: opts?.limit ?? 10,
  });
  return data.items;
}

export async function createDiaryBlockTemplate(
  subjectKind: DiarySubjectKind,
  input: {
    name: string;
    preset: DiaryBlockTemplateRow["preset"];
    sort_order?: number;
  },
): Promise<DiaryBlockTemplateRow> {
  const data = await habitat().call("diary.templateCreate", {
    subject_kind: subjectKind,
    ...input,
  });
  return data.item;
}

export async function updateDiaryBlockTemplate(
  subjectKind: DiarySubjectKind,
  id: number,
  patch: {
    name?: string;
    preset?: Partial<DiaryBlockTemplateRow["preset"]>;
    sort_order?: number;
  },
): Promise<DiaryBlockTemplateRow> {
  const data = await habitat().call("diary.templatePatch", {
    subject_kind: subjectKind,
    id,
    ...patch,
  });
  return data.item;
}

export async function deleteDiaryBlockTemplate(
  subjectKind: DiarySubjectKind,
  id: number,
): Promise<void> {
  await habitat().call("diary.templateDelete", { subject_kind: subjectKind, id });
}

export async function deleteDiaryBlock(
  subjectKind: DiarySubjectKind,
  parentId: number,
  blockId: number,
): Promise<void> {
  ensureDiaryOfflineModule();
  return offlineDeleteDiaryBlock(subjectKind, parentId, blockId);
}

export async function reorderDiaryBlocks(
  subjectKind: DiarySubjectKind,
  parentId: number,
  items: Array<{ id: number; sort_order: number }>,
): Promise<DiaryTextBlock[]> {
  ensureDiaryOfflineModule();
  return offlineReorderDiaryBlocks(subjectKind, parentId, items);
}

export { countDiaryPendingOps } from "./offline-store.ts";
