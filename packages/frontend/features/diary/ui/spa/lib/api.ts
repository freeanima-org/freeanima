import type { DiaryEntryRow, DiaryTextBlock } from "./format-diary.ts";
import { resolveHabitatCacheScope } from "@freeanima/client/portal-sdk/offline-cache";
import { withOfflineCache } from "@freeanima/client/portal-sdk/offline-cache-first";
import { getTypedHabitatClient } from "@freeanima/client/portal-sdk/habitat-typed-client.ts";

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

function diaryListCacheId(subjectId: number, query?: string): string {
  const q = query?.trim();
  return q ? `search:${subjectId}:${q}` : `list:${subjectId}`;
}

function diaryEntryCacheId(subjectId: number, id: number): string {
  return `entry:${subjectId}:${id}`;
}

export async function fetchDiaryEntries(
  subjectId: number,
  opts?: { limit?: number; offset?: number },
): Promise<DiaryEntryRow[]> {
  const limit = opts?.limit ?? 20;
  const offset = opts?.offset ?? 0;

  // 分页后续页不走 list cache，避免把「仅首屏」写成「全量」
  if (offset > 0) {
    const data = await habitat().call("diary.list", {
      subject_id: subjectId,
      limit,
      offset,
    });
    return data.items;
  }

  const scope = resolveHabitatCacheScope();
  const cacheId = diaryListCacheId(subjectId);
  return withOfflineCache({
    scope,
    namespace: "diary",
    id: cacheId,
    fetch: async () => {
      const data = await habitat().call("diary.list", {
        subject_id: subjectId,
        limit,
        offset: 0,
      });
      return data.items;
    },
    reconcile: (items) => reconcileServerDiaryList(subjectId, items),
    offlineError: "diary.list unavailable offline",
  });
}

export async function searchDiaryEntries(
  subjectId: number,
  query: string,
  limit?: number,
): Promise<DiaryEntryRow[]> {
  const scope = resolveHabitatCacheScope();
  const cacheId = diaryListCacheId(subjectId, query);
  return withOfflineCache({
    scope,
    namespace: "diary",
    id: cacheId,
    fetch: async () => {
      const data = await habitat().call("diary.search", {
        subject_id: subjectId,
        query,
        limit,
      });
      return data.items;
    },
    offlineError: "diary.search unavailable offline",
  });
}

export async function getDiaryEntry(subjectId: number, id: number): Promise<DiaryEntryRow> {
  const scope = resolveHabitatCacheScope();
  const cacheId = diaryEntryCacheId(subjectId, id);
  return withOfflineCache({
    scope,
    namespace: "diary",
    id: cacheId,
    fetch: async () => {
      const data = await habitat().call("diary.get", { subject_id: subjectId, id });
      return data.item;
    },
    offlineError: "diary.get unavailable offline",
  });
}

export async function createDiaryEntry(
  subjectId: number,
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
  return offlineCreateDiaryEntry(subjectId, input);
}

export async function appendDiaryEntry(
  subjectId: number,
  id: number,
  content: string,
): Promise<DiaryEntryRow> {
  ensureDiaryOfflineModule();
  return offlineAppendDiaryEntry(subjectId, id, content);
}

export async function updateDiaryEntry(
  subjectId: number,
  id: number,
  patch: Partial<Pick<DiaryEntryRow, "title" | "summary" | "entry_at" | "tag_ids">> & {
    tags?: string[];
  },
): Promise<DiaryEntryRow> {
  ensureDiaryOfflineModule();
  return offlineUpdateDiaryEntry(subjectId, id, patch);
}

export async function deleteDiaryEntry(subjectId: number, id: number): Promise<void> {
  ensureDiaryOfflineModule();
  return offlineDeleteDiaryEntry(subjectId, id);
}

export async function createDiaryBlock(
  subjectId: number,
  parentId: number,
  input: {
    content: string;
    title?: string;
    tag_ids?: number[];
    components?: string[];
    sort_order?: number;
    client_op_id?: string;
  },
): Promise<DiaryTextBlock> {
  ensureDiaryOfflineModule();
  return offlineCreateDiaryBlock(subjectId, parentId, input);
}

export async function updateDiaryBlock(
  subjectId: number,
  id: number,
  patch: { content?: string; title?: string; tag_ids?: number[]; sort_order?: number },
): Promise<DiaryTextBlock> {
  ensureDiaryOfflineModule();
  return offlineUpdateDiaryBlock(subjectId, id, patch);
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
  subjectId: number,
): Promise<DiaryBlockTemplateRow[]> {
  const data = await habitat().call("diary.templateList", { subject_id: subjectId });
  return data.items;
}

export async function suggestDiaryTags(
  subjectId: number,
  opts?: { query?: string; limit?: number },
): Promise<Array<{ id: number; title: string; count: number }>> {
  const data = await habitat().call("diary.suggestTags", {
    subject_id: subjectId,
    ...(opts?.query != null && opts.query !== "" ? { query: opts.query } : {}),
    limit: opts?.limit ?? 10,
  });
  return data.items;
}

export async function createDiaryBlockTemplate(
  subjectId: number,
  input: {
    name: string;
    preset: DiaryBlockTemplateRow["preset"];
    sort_order?: number;
  },
): Promise<DiaryBlockTemplateRow> {
  const data = await habitat().call("diary.templateCreate", {
    subject_id: subjectId,
    ...input,
  });
  return data.item;
}

export async function updateDiaryBlockTemplate(
  subjectId: number,
  id: number,
  patch: {
    name?: string;
    preset?: Partial<DiaryBlockTemplateRow["preset"]>;
    sort_order?: number;
  },
): Promise<DiaryBlockTemplateRow> {
  const data = await habitat().call("diary.templatePatch", {
    subject_id: subjectId,
    id,
    ...patch,
  });
  return data.item;
}

export async function deleteDiaryBlockTemplate(subjectId: number, id: number): Promise<void> {
  await habitat().call("diary.templateDelete", { subject_id: subjectId, id });
}

export async function deleteDiaryBlock(
  subjectId: number,
  parentId: number,
  blockId: number,
): Promise<void> {
  ensureDiaryOfflineModule();
  return offlineDeleteDiaryBlock(subjectId, parentId, blockId);
}

export async function reorderDiaryBlocks(
  subjectId: number,
  parentId: number,
  items: Array<{ id: number; sort_order: number }>,
): Promise<DiaryTextBlock[]> {
  ensureDiaryOfflineModule();
  return offlineReorderDiaryBlocks(subjectId, parentId, items);
}

export { countDiaryPendingOps } from "./offline-store.ts";
