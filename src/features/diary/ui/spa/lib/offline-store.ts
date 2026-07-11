import {
  readOfflineCache,
  resolveHubCacheScope,
  writeOfflineCache,
} from "@freeanima/frontend/shell-sdk/offline-cache";
import { resolveIdFields } from "@freeanima/frontend/shell-sdk/offline-id-map";
import {
  registerOfflineModule,
  registerOfflineModuleCap,
} from "@freeanima/frontend/shell-sdk/offline-module-registry";
import type { RpcModuleAdapter } from "@freeanima/frontend/shell-sdk/offline-module-types";
import {
  enqueueOutboxOp,
  listOutboxOps,
  removeOutboxOp,
  resolveOutboxScope,
  type OfflineOutboxOp,
} from "@freeanima/frontend/shell-sdk/offline-outbox";
import {
  flushOfflineModule,
  recordFlushIdMapping,
} from "@freeanima/frontend/shell-sdk/offline-sync";
import { allocateTempId, isTempId } from "@freeanima/frontend/shell-sdk/offline-temp-id";
import { getTypedSatelliteHubClient } from "@freeanima/platform/hub";

import type { DiaryEntryRow, DiarySubjectKind } from "./format-diary.ts";

const MODULE_ID = "diary";
const NAMESPACE = "diary";

function listCacheId(subjectKind: DiarySubjectKind): string {
  return `list:${subjectKind}`;
}

function entryCacheId(subjectKind: DiarySubjectKind, id: number): string {
  return `entry:${subjectKind}:${id}`;
}

async function readLocalList(
  scope: string,
  subjectKind: DiarySubjectKind,
): Promise<DiaryEntryRow[]> {
  const cached = await readOfflineCache<DiaryEntryRow[]>(
    scope,
    NAMESPACE,
    listCacheId(subjectKind),
  );
  return cached ?? [];
}

async function writeLocalList(
  scope: string,
  subjectKind: DiarySubjectKind,
  items: DiaryEntryRow[],
): Promise<void> {
  const sorted = items.toSorted((a, b) => b.entry_at.localeCompare(a.entry_at));
  await writeOfflineCache(scope, NAMESPACE, listCacheId(subjectKind), sorted);
}

async function upsertLocalEntry(
  scope: string,
  subjectKind: DiarySubjectKind,
  entry: DiaryEntryRow,
): Promise<void> {
  const list = await readLocalList(scope, subjectKind);
  const next = list.filter((e) => e.id !== entry.id);
  next.unshift(entry);
  await writeLocalList(scope, subjectKind, next);
  await writeOfflineCache(scope, NAMESPACE, entryCacheId(subjectKind, entry.id), entry);
}

async function removeLocalEntry(
  scope: string,
  subjectKind: DiarySubjectKind,
  id: number,
): Promise<void> {
  const list = await readLocalList(scope, subjectKind);
  await writeLocalList(
    scope,
    subjectKind,
    list.filter((e) => e.id !== id),
  );
}

function scheduleFlush(scope: string): void {
  void flushOfflineModule(MODULE_ID, scope).catch(() => {});
}

export function compactDiaryOutbox(ops: OfflineOutboxOp[]): OfflineOutboxOp[] {
  const byTemp = new Map<number, OfflineOutboxOp>();
  const result: OfflineOutboxOp[] = [];

  for (const op of ops) {
    if (op.method === "diary.delete") {
      const id = op.payload.id;
      if (typeof id === "number" && isTempId(id)) {
        byTemp.delete(id);
        continue;
      }
      result.push(op);
      continue;
    }

    if (op.method === "diary.create" && op.tempEntityId != null) {
      const prev = byTemp.get(op.tempEntityId);
      if (prev) {
        byTemp.set(op.tempEntityId, {
          ...prev,
          payload: { ...prev.payload, ...op.payload },
          createdAt: op.createdAt,
        });
      } else {
        byTemp.set(op.tempEntityId, op);
      }
      continue;
    }

    if (op.method === "diary.patch" || op.method === "diary.append") {
      const id = op.payload.id;
      if (typeof id === "number" && isTempId(id)) {
        const createOp = byTemp.get(id);
        if (createOp) {
          const merged = mergePatchIntoCreate(createOp, op);
          byTemp.set(id, merged);
          continue;
        }
      }
    }

    result.push(op);
  }

  return [...byTemp.values(), ...result].toSorted((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function mergePatchIntoCreate(
  createOp: OfflineOutboxOp,
  patchOp: OfflineOutboxOp,
): OfflineOutboxOp {
  const payload = { ...createOp.payload };
  if (patchOp.method === "diary.append") {
    const prev = typeof payload.content === "string" ? payload.content : "";
    const fragment = String(patchOp.payload.content ?? "");
    payload.content = prev.trim() ? `${prev.trim()}\n\n${fragment}` : fragment;
  } else {
    Object.assign(payload, patchOp.payload);
    delete payload.id;
  }
  return { ...createOp, payload, createdAt: patchOp.createdAt };
}

async function flushDiaryOp(op: OfflineOutboxOp, scope: string): Promise<"done" | "failed"> {
  const hub = getTypedSatelliteHubClient();
  try {
    const result = (await hub.call(op.method as never, op.payload as never)) as {
      item?: DiaryEntryRow;
    };
    if (op.tempEntityId != null && op.method === "diary.create" && result.item?.id) {
      await recordFlushIdMapping(scope, MODULE_ID, op.tempEntityId, result.item.id);
    }
    return "done";
  } catch {
    return "failed";
  }
}

export const diaryRpcAdapter: RpcModuleAdapter = {
  kind: "rpc",
  moduleId: MODULE_ID,
  ordering: "fifo",
  compactOutbox: compactDiaryOutbox,
  resolvePayloadIds: (payload, idMap) => resolveIdFields(payload, idMap, ["id"]),
  flushOp: async (op, ctx) => flushDiaryOp(op, ctx.scope),
  refreshAll: async (scope) => {
    const hub = getTypedSatelliteHubClient();
    for (const subjectKind of ["user", "agent"] as const) {
      try {
        const data = await hub.call("diary.list", {
          subject_kind: subjectKind,
          limit: 200,
        });
        await writeOfflineCache(scope, NAMESPACE, listCacheId(subjectKind), data.items);
      } catch {
        /* keep local snapshot */
      }
    }
  },
};

export function registerDiaryOfflineModule(): void {
  registerOfflineModule(diaryRpcAdapter);
  registerOfflineModuleCap(MODULE_ID, { offlineWritable: true });
}

export async function offlineCreateDiaryEntry(
  subjectKind: DiarySubjectKind,
  input: {
    title: string;
    content?: string;
    summary?: string;
    entry_at: string;
    tags?: string[];
  },
): Promise<DiaryEntryRow> {
  const scope = resolveOutboxScope();
  const tempId = allocateTempId(scope, MODULE_ID);
  const opId = crypto.randomUUID();
  const now = new Date().toISOString();
  const row: DiaryEntryRow = {
    id: tempId,
    title: input.title,
    content: input.content ?? "",
    summary: input.summary ?? "",
    entry_at: input.entry_at,
    tags: input.tags ?? [],
    created_at: now,
    updated_at: now,
  };
  await upsertLocalEntry(scope, subjectKind, row);
  await enqueueOutboxOp(scope, {
    id: opId,
    moduleId: MODULE_ID,
    method: "diary.create",
    payload: {
      subject_kind: subjectKind,
      client_op_id: opId,
      ...input,
    },
    tempEntityId: tempId,
    createdAt: now,
  });
  scheduleFlush(scope);
  return row;
}

export async function offlineUpdateDiaryEntry(
  subjectKind: DiarySubjectKind,
  id: number,
  patch: Partial<Pick<DiaryEntryRow, "title" | "content" | "summary" | "entry_at" | "tags">>,
): Promise<DiaryEntryRow> {
  const scope = resolveOutboxScope();
  const list = await readLocalList(scope, subjectKind);
  const existing = list.find((e) => e.id === id);
  if (!existing) throw new Error("diary entry not found locally");

  const now = new Date().toISOString();
  const updated: DiaryEntryRow = {
    ...existing,
    ...patch,
    updated_at: now,
  };
  await upsertLocalEntry(scope, subjectKind, updated);

  const opId = crypto.randomUUID();
  await enqueueOutboxOp(scope, {
    id: opId,
    moduleId: MODULE_ID,
    method: "diary.patch",
    payload: {
      subject_kind: subjectKind,
      id,
      client_op_id: opId,
      ...patch,
    },
    createdAt: now,
  });
  scheduleFlush(scope);
  return updated;
}

export async function offlineAppendDiaryEntry(
  subjectKind: DiarySubjectKind,
  id: number,
  content: string,
): Promise<DiaryEntryRow> {
  const scope = resolveOutboxScope();
  const list = await readLocalList(scope, subjectKind);
  const existing = list.find((e) => e.id === id);
  if (!existing) throw new Error("diary entry not found locally");

  const fragment = content.trim();
  const nextContent = existing.content.trim()
    ? `${existing.content.trim()}\n\n${fragment}`
    : fragment;
  const now = new Date().toISOString();
  const updated: DiaryEntryRow = { ...existing, content: nextContent, updated_at: now };
  await upsertLocalEntry(scope, subjectKind, updated);

  const opId = crypto.randomUUID();
  await enqueueOutboxOp(scope, {
    id: opId,
    moduleId: MODULE_ID,
    method: "diary.append",
    payload: {
      subject_kind: subjectKind,
      id,
      content: fragment,
      client_op_id: opId,
    },
    createdAt: now,
  });
  scheduleFlush(scope);
  return updated;
}

export async function offlineDeleteDiaryEntry(
  subjectKind: DiarySubjectKind,
  id: number,
): Promise<void> {
  const scope = resolveOutboxScope();
  await removeLocalEntry(scope, subjectKind, id);

  if (isTempId(id)) {
    const ops = await listOutboxOps(scope, MODULE_ID);
    for (const op of ops) {
      if (op.tempEntityId === id || op.payload.id === id) {
        await removeOutboxOp(scope, op.id);
      }
    }
    return;
  }

  const opId = crypto.randomUUID();
  await enqueueOutboxOp(scope, {
    id: opId,
    moduleId: MODULE_ID,
    method: "diary.delete",
    payload: { subject_kind: subjectKind, id, client_op_id: opId },
    createdAt: new Date().toISOString(),
  });
  scheduleFlush(scope);
}

export async function countDiaryPendingOps(): Promise<number> {
  return listOutboxOps(resolveOutboxScope(), MODULE_ID).then((ops) => ops.length);
}

export { resolveHubCacheScope };
