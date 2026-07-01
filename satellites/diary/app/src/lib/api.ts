import type { DiaryEntryRow, DiarySubjectKind } from "./format-diary.ts";
import { whenSapClientReady } from "./hub-rpc.ts";

async function sap() {
  return whenSapClientReady();
}

export async function fetchDiaryEntries(
  subjectKind: DiarySubjectKind,
  opts?: { limit?: number },
): Promise<DiaryEntryRow[]> {
  const client = await sap();
  const data = await client.request("diary.list", {
    subject_kind: subjectKind,
    limit: opts?.limit ?? 200,
  });
  return data.items;
}

export async function searchDiaryEntries(
  subjectKind: DiarySubjectKind,
  query: string,
  limit?: number,
): Promise<DiaryEntryRow[]> {
  const client = await sap();
  const data = await client.request("diary.search", {
    subject_kind: subjectKind,
    query,
    limit,
  });
  return data.items;
}

export async function getDiaryEntry(
  subjectKind: DiarySubjectKind,
  id: number,
): Promise<DiaryEntryRow> {
  const client = await sap();
  const data = await client.request("diary.get", { subject_kind: subjectKind, id });
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
