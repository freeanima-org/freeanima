import {
  readOfflineCache,
  resolveHabitatCacheScope,
  writeOfflineCache,
} from "@freeanima/client/portal-sdk/offline-cache";
import { getIdMapping, resolveIdFields } from "@freeanima/client/portal-sdk/offline-id-map";
import {
  registerOfflineModule,
  registerOfflineModuleCap,
} from "@freeanima/client/portal-sdk/offline-module-registry";
import type { RpcModuleAdapter } from "@freeanima/client/portal-sdk/offline-module-types";
import {
  enqueueOutboxOp,
  listOutboxOps,
  removeOutboxOp,
  resolveOutboxScope,
  type OfflineOutboxOp,
} from "@freeanima/client/portal-sdk/offline-outbox";
import {
  flushOfflineModule,
  recordFlushIdMapping,
} from "@freeanima/client/portal-sdk/offline-sync";
import {
  allocateTempId,
  isTempId,
  seedTempIdAllocatorFromIdMap,
} from "@freeanima/client/portal-sdk/offline-temp-id";
import { preferOnlineWrite } from "@freeanima/client/portal-sdk/prefer-online-write";
import { getTypedHabitatClient } from "@freeanima/client/portal-sdk/habitat-typed-client.ts";
import { coerceString } from "@freeanima/shared/coerce-string";
import { randomPublicId } from "@freeanima/shared/util";

import type { DiaryEntryRow, DiarySubjectKind, DiaryTextBlock } from "./format-diary.ts";

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

async function rewriteLocalEntryId(
  scope: string,
  subjectKind: DiarySubjectKind,
  tempId: number,
  serverId: number,
  serverRow?: DiaryEntryRow,
): Promise<void> {
  const list = await readLocalList(scope, subjectKind);
  const existing = list.find((e) => e.id === tempId);
  const rewritten: DiaryEntryRow = serverRow
    ? { ...serverRow }
    : existing
      ? {
          ...existing,
          id: serverId,
          blocks: existing.blocks.map((b) => ({
            ...b,
            parent_id: serverId,
          })),
        }
      : {
          id: serverId,
          title: "",
          summary: "",
          entry_at: new Date().toISOString(),
          tag_ids: [],
          blocks: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
  const next = list.filter((e) => e.id !== tempId && e.id !== serverId);
  next.unshift(rewritten);
  await writeLocalList(scope, subjectKind, next);
  await writeOfflineCache(scope, NAMESPACE, entryCacheId(subjectKind, serverId), rewritten);
}

async function resolveEntityId(scope: string, id: number): Promise<number> {
  if (!isTempId(id)) return id;
  const mapped = await getIdMapping(scope, MODULE_ID, id);
  return mapped ?? id;
}

async function findLocalEntry(
  scope: string,
  subjectKind: DiarySubjectKind,
  id: number,
): Promise<DiaryEntryRow | undefined> {
  const resolvedId = await resolveEntityId(scope, id);
  const list = await readLocalList(scope, subjectKind);
  return (
    list.find((e) => e.id === resolvedId) ??
    (resolvedId !== id ? list.find((e) => e.id === id) : undefined)
  );
}

async function ensureAllocatorSeeded(scope: string): Promise<void> {
  await seedTempIdAllocatorFromIdMap(scope, MODULE_ID);
}

function scheduleFlush(scope: string): void {
  void flushOfflineModule(MODULE_ID, scope).catch(() => {});
}

function habitat() {
  return getTypedHabitatClient();
}

/** temp 且尚无 id-map 时栖息地不认识该实体，只能走 outbox。 */
async function unresolvedTempId(scope: string, id: number): Promise<boolean> {
  if (!isTempId(id)) return false;
  return (await getIdMapping(scope, MODULE_ID, id)) == null;
}

async function pendingTempEntryIds(scope: string): Promise<Set<number>> {
  const ops = await listOutboxOps(scope, MODULE_ID);
  const ids = new Set<number>();
  for (const op of ops) {
    if (op.method === "diary.create" && typeof op.tempEntityId === "number") {
      ids.add(op.tempEntityId);
    }
  }
  return ids;
}

async function mergeServerList(
  scope: string,
  subjectKind: DiarySubjectKind,
  serverItems: DiaryEntryRow[],
): Promise<DiaryEntryRow[]> {
  const local = await readLocalList(scope, subjectKind);
  const localById = new Map(local.map((e) => [e.id, e]));
  // diary.list 故意不带 blocks（空数组=未加载）；勿覆盖本地已缓存的块
  const withBlocks = serverItems.map((server) => {
    const prev = localById.get(server.id);
    if (!prev || server.blocks.length > 0 || prev.blocks.length === 0) return server;
    return {
      ...server,
      blocks: prev.blocks.map((b) =>
        b.parent_id === server.id ? b : { ...b, parent_id: server.id },
      ),
    };
  });

  const tempIds = await pendingTempEntryIds(scope);
  if (tempIds.size === 0) return withBlocks;
  const serverIds = new Set(withBlocks.map((e) => e.id));
  const pendingTemps = local.filter((e) => tempIds.has(e.id) && !serverIds.has(e.id));
  if (pendingTemps.length === 0) return withBlocks;
  return [...pendingTemps, ...withBlocks].toSorted((a, b) => b.entry_at.localeCompare(a.entry_at));
}

export async function reconcileServerDiaryList(
  subjectKind: DiarySubjectKind,
  serverItems: DiaryEntryRow[],
): Promise<DiaryEntryRow[]> {
  return mergeServerList(resolveOutboxScope(), subjectKind, serverItems);
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
    const fragment = coerceString(patchOp.payload.content);
    const prev = typeof payload.content === "string" ? payload.content : "";
    payload.content = prev.trim() ? `${prev.trim()}\n\n${fragment}` : fragment;
  } else {
    Object.assign(payload, patchOp.payload);
    delete payload.id;
  }
  return { ...createOp, payload, createdAt: patchOp.createdAt };
}

async function flushDiaryOp(
  op: OfflineOutboxOp,
  scope: string,
): Promise<import("@freeanima/client/portal-sdk/offline-module-types").FlushOpOutcome> {
  try {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- as never 类型对齐边界
    const result = (await habitat().call(op.method as never, op.payload as never)) as {
      item?: DiaryEntryRow | DiaryTextBlock;
    };
    if (
      op.tempEntityId != null &&
      op.method === "diary.create" &&
      result.item &&
      "blocks" in result.item
    ) {
      const subjectKind =
        op.payload.subject_kind === "agent" ? ("agent" as const) : ("user" as const);
      await recordFlushIdMapping(scope, MODULE_ID, op.tempEntityId, result.item.id);
      await rewriteLocalEntryId(scope, subjectKind, op.tempEntityId, result.item.id, result.item);
    }
    if (
      op.tempEntityId != null &&
      op.method === "diary.blockCreate" &&
      result.item &&
      "parent_id" in result.item &&
      !("blocks" in result.item)
    ) {
      const subjectKind =
        op.payload.subject_kind === "agent" ? ("agent" as const) : ("user" as const);
      await recordFlushIdMapping(scope, MODULE_ID, op.tempEntityId, result.item.id);
      const parentId =
        typeof op.payload.parent_id === "number" ? op.payload.parent_id : result.item.parent_id;
      const entry = await findLocalEntry(scope, subjectKind, parentId);
      if (entry) {
        const blocks = entry.blocks
          .filter((b) => b.id !== op.tempEntityId)
          .concat([{ ...result.item }])
          .toSorted((a, b) => a.sort_order - b.sort_order || a.id - b.id);
        await upsertLocalEntry(scope, subjectKind, { ...entry, blocks });
      }
    }
    return { status: "done" };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { status: "failed", error: message };
  }
}

export const diaryRpcAdapter: RpcModuleAdapter = {
  kind: "rpc",
  moduleId: MODULE_ID,
  ordering: "fifo",
  compactOutbox: compactDiaryOutbox,
  resolvePayloadIds: (payload, idMap) => resolveIdFields(payload, idMap, ["id", "parent_id"]),
  flushOp: async (op, ctx) => flushDiaryOp(op, ctx.scope),
  refreshAll: async (scope) => {
    for (const subjectKind of ["user", "agent"] as const) {
      try {
        const data = await habitat().call("diary.list", {
          subject_kind: subjectKind,
          limit: 200,
        });
        const merged = await mergeServerList(scope, subjectKind, data.items);
        await writeLocalList(scope, subjectKind, merged);
      } catch {
        /* keep local snapshot */
      }
    }
  },
};

export function registerDiaryOfflineModule(): void {
  registerOfflineModule(diaryRpcAdapter);
  registerOfflineModuleCap(MODULE_ID, { offlineWritable: true });
  void ensureAllocatorSeeded(resolveOutboxScope()).catch(() => {});
}

export async function offlineCreateDiaryEntry(
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
  const title = input.title.trim();
  if (title.length === 0) throw new Error("diary title is required");
  if (!input.entry_at.trim()) throw new Error("diary entry_at is required");

  const payload = { ...input, title };

  return preferOnlineWrite(
    async () => {
      const scope = resolveOutboxScope();
      const opId = randomPublicId();
      const data = await habitat().call("diary.create", {
        subject_kind: subjectKind,
        client_op_id: opId,
        ...payload,
      });
      await upsertLocalEntry(scope, subjectKind, data.item);
      return data.item;
    },
    async () => {
      const scope = resolveOutboxScope();
      await ensureAllocatorSeeded(scope);
      const tempId = allocateTempId(scope, MODULE_ID);
      const opId = randomPublicId();
      const now = new Date().toISOString();
      const initialContent = input.content?.trim() ?? "";
      const blocks: DiaryTextBlock[] = initialContent
        ? [
            {
              id: allocateTempId(scope, MODULE_ID),
              title: "",
              content: initialContent,
              sort_order: 0,
              parent_id: tempId,
              client_op_id: null,
              components: ["content_block"],
              tag_ids: [],
              created_at: now,
              updated_at: now,
            },
          ]
        : [];
      const row: DiaryEntryRow = {
        id: tempId,
        title,
        summary: input.summary ?? "",
        entry_at: input.entry_at,
        tag_ids: input.tag_ids ?? [],
        blocks,
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
          ...payload,
        },
        tempEntityId: tempId,
        createdAt: now,
      });
      scheduleFlush(scope);
      return row;
    },
  );
}

export async function offlineUpdateDiaryEntry(
  subjectKind: DiarySubjectKind,
  id: number,
  patch: Partial<Pick<DiaryEntryRow, "title" | "summary" | "entry_at" | "tag_ids">> & {
    tags?: string[];
  },
): Promise<DiaryEntryRow> {
  const scope = resolveOutboxScope();
  const existing = await findLocalEntry(scope, subjectKind, id);
  if (!existing) throw new Error("diary entry not found locally");
  const resolvedId = existing.id;

  const doOffline = async (): Promise<DiaryEntryRow> => {
    const now = new Date().toISOString();
    const updated: DiaryEntryRow = {
      ...existing,
      ...patch,
      updated_at: now,
    };
    await upsertLocalEntry(scope, subjectKind, updated);

    const opId = randomPublicId();
    await enqueueOutboxOp(scope, {
      id: opId,
      moduleId: MODULE_ID,
      method: "diary.patch",
      payload: {
        subject_kind: subjectKind,
        id: resolvedId,
        client_op_id: opId,
        ...patch,
      },
      createdAt: now,
    });
    scheduleFlush(scope);
    return updated;
  };

  if (await unresolvedTempId(scope, resolvedId)) {
    return doOffline();
  }

  return preferOnlineWrite(async () => {
    const opId = randomPublicId();
    const data = await habitat().call("diary.patch", {
      subject_kind: subjectKind,
      id: resolvedId,
      client_op_id: opId,
      ...patch,
    });
    await upsertLocalEntry(scope, subjectKind, data.item);
    return data.item;
  }, doOffline);
}

export async function offlineAppendDiaryEntry(
  subjectKind: DiarySubjectKind,
  id: number,
  content: string,
): Promise<DiaryEntryRow> {
  const scope = resolveOutboxScope();
  const existing = await findLocalEntry(scope, subjectKind, id);
  if (!existing) throw new Error("diary entry not found locally");
  const resolvedId = existing.id;
  const fragment = content.trim();

  const doOffline = async (): Promise<DiaryEntryRow> => {
    const now = new Date().toISOString();
    const last = existing.blocks.toSorted((a, b) => a.sort_order - b.sort_order).at(-1);
    const block: DiaryTextBlock = {
      id: allocateTempId(scope, MODULE_ID),
      title: "",
      content: fragment,
      sort_order: last ? last.sort_order + 1 : 0,
      parent_id: resolvedId,
      client_op_id: null,
      components: ["content_block"],
      tag_ids: [],
      created_at: now,
      updated_at: now,
    };
    const updated: DiaryEntryRow = {
      ...existing,
      blocks: [...existing.blocks, block],
      updated_at: now,
    };
    await upsertLocalEntry(scope, subjectKind, updated);

    const opId = randomPublicId();
    await enqueueOutboxOp(scope, {
      id: opId,
      moduleId: MODULE_ID,
      method: "diary.append",
      payload: {
        subject_kind: subjectKind,
        id: resolvedId,
        content: fragment,
        client_op_id: opId,
      },
      createdAt: now,
    });
    scheduleFlush(scope);
    return updated;
  };

  if (await unresolvedTempId(scope, resolvedId)) {
    return doOffline();
  }

  return preferOnlineWrite(async () => {
    const opId = randomPublicId();
    const data = await habitat().call("diary.append", {
      subject_kind: subjectKind,
      id: resolvedId,
      content: fragment,
      client_op_id: opId,
    });
    await upsertLocalEntry(scope, subjectKind, data.item);
    return data.item;
  }, doOffline);
}

export type OfflineDiaryBlockCreateInput = {
  content: string;
  title?: string;
  tag_ids?: number[];
  components?: string[];
  sort_order?: number;
  client_op_id?: string;
};

export async function offlineCreateDiaryBlock(
  subjectKind: DiarySubjectKind,
  parentId: number,
  input: OfflineDiaryBlockCreateInput | string,
  sortOrder?: number,
): Promise<DiaryTextBlock> {
  const opts: OfflineDiaryBlockCreateInput =
    typeof input === "string"
      ? sortOrder !== undefined
        ? { content: input, sort_order: sortOrder }
        : { content: input }
      : input;
  const scope = resolveOutboxScope();
  await ensureAllocatorSeeded(scope);
  const existing = await findLocalEntry(scope, subjectKind, parentId);
  if (!existing) throw new Error("diary entry not found locally");
  const resolvedParentId = existing.id;

  const doOffline = async (): Promise<DiaryTextBlock> => {
    const now = new Date().toISOString();
    const last = existing.blocks.toSorted((a, b) => a.sort_order - b.sort_order).at(-1);
    const tempId = allocateTempId(scope, MODULE_ID);
    const opId = opts.client_op_id?.trim() || randomPublicId();
    const block: DiaryTextBlock = {
      id: tempId,
      title: opts.title?.trim() ?? "",
      content: opts.content,
      sort_order: opts.sort_order ?? (last ? last.sort_order + 1 : 0),
      parent_id: resolvedParentId,
      client_op_id: opId,
      components: opts.components ?? ["content_block"],
      tag_ids: opts.tag_ids ?? [],
      created_at: now,
      updated_at: now,
    };
    await upsertLocalEntry(scope, subjectKind, {
      ...existing,
      blocks: [...existing.blocks, block],
      updated_at: now,
    });
    await enqueueOutboxOp(scope, {
      id: opId,
      moduleId: MODULE_ID,
      method: "diary.blockCreate",
      payload: {
        subject_kind: subjectKind,
        parent_id: resolvedParentId,
        content: block.content,
        title: block.title,
        tag_ids: block.tag_ids,
        components: block.components,
        sort_order: block.sort_order,
        client_op_id: opId,
      },
      tempEntityId: tempId,
      createdAt: now,
    });
    scheduleFlush(scope);
    return block;
  };

  if (await unresolvedTempId(scope, resolvedParentId)) {
    return doOffline();
  }

  return preferOnlineWrite(async () => {
    const opId = opts.client_op_id?.trim() || randomPublicId();
    const data = await habitat().call("diary.blockCreate", {
      subject_kind: subjectKind,
      parent_id: resolvedParentId,
      content: opts.content,
      ...(opts.title !== undefined ? { title: opts.title } : {}),
      ...(opts.tag_ids !== undefined ? { tag_ids: opts.tag_ids } : {}),
      ...(opts.components !== undefined ? { components: opts.components } : {}),
      ...(opts.sort_order != null ? { sort_order: opts.sort_order } : {}),
      client_op_id: opId,
    });
    const entry = await findLocalEntry(scope, subjectKind, resolvedParentId);
    if (entry) {
      const blocks = entry.blocks
        .concat([data.item])
        .toSorted((a, b) => a.sort_order - b.sort_order || a.id - b.id);
      await upsertLocalEntry(scope, subjectKind, {
        ...entry,
        blocks,
        updated_at: new Date().toISOString(),
      });
    }
    return data.item;
  }, doOffline);
}

export async function offlineUpdateDiaryBlock(
  subjectKind: DiarySubjectKind,
  id: number,
  patch: { content?: string; title?: string; tag_ids?: number[]; sort_order?: number },
): Promise<DiaryTextBlock> {
  const scope = resolveOutboxScope();
  const resolvedId = await resolveEntityId(scope, id);
  const list = await readLocalList(scope, subjectKind);
  let parent: DiaryEntryRow | undefined;
  let block: DiaryTextBlock | undefined;
  for (const entry of list) {
    const found = entry.blocks.find((b) => b.id === resolvedId || b.id === id);
    if (found) {
      parent = entry;
      block = found;
      break;
    }
  }
  if (!parent || !block) throw new Error("diary block not found locally");
  const localParent = parent;
  const localBlock = block;
  const localBlockId = localBlock.id;

  const doOffline = async (): Promise<DiaryTextBlock> => {
    const now = new Date().toISOString();
    const updatedBlock: DiaryTextBlock = {
      ...localBlock,
      ...patch,
      id: localBlockId,
      updated_at: now,
    };
    await upsertLocalEntry(scope, subjectKind, {
      ...localParent,
      blocks: localParent.blocks.map((b) => (b.id === localBlockId ? updatedBlock : b)),
      updated_at: now,
    });

    const opId = randomPublicId();
    await enqueueOutboxOp(scope, {
      id: opId,
      moduleId: MODULE_ID,
      method: "diary.blockPatch",
      payload: {
        subject_kind: subjectKind,
        id: resolvedId,
        client_op_id: opId,
        ...patch,
      },
      createdAt: now,
    });
    scheduleFlush(scope);
    return updatedBlock;
  };

  if (await unresolvedTempId(scope, resolvedId)) {
    return doOffline();
  }

  return preferOnlineWrite(async () => {
    const opId = randomPublicId();
    const data = await habitat().call("diary.blockPatch", {
      subject_kind: subjectKind,
      id: resolvedId,
      client_op_id: opId,
      ...patch,
    });
    const entry = await findLocalEntry(scope, subjectKind, localParent.id);
    if (entry) {
      await upsertLocalEntry(scope, subjectKind, {
        ...entry,
        blocks: entry.blocks.map((b) => (b.id === localBlockId ? data.item : b)),
        updated_at: new Date().toISOString(),
      });
    }
    return data.item;
  }, doOffline);
}

export async function offlineDeleteDiaryBlock(
  subjectKind: DiarySubjectKind,
  parentId: number,
  blockId: number,
): Promise<void> {
  const scope = resolveOutboxScope();
  const existing = await findLocalEntry(scope, subjectKind, parentId);
  if (!existing) throw new Error("diary entry not found locally");

  const doOffline = async (): Promise<void> => {
    const now = new Date().toISOString();
    await upsertLocalEntry(scope, subjectKind, {
      ...existing,
      blocks: existing.blocks.filter((b) => b.id !== blockId),
      updated_at: now,
    });

    if (isTempId(blockId)) {
      const ops = await listOutboxOps(scope, MODULE_ID);
      for (const op of ops) {
        if (
          (typeof op.tempEntityId === "number" && op.tempEntityId === blockId) ||
          (op.method === "diary.blockCreate" && op.payload.client_op_id != null)
        ) {
          if (op.tempEntityId === blockId) await removeOutboxOp(scope, op.id);
        }
      }
      return;
    }

    const opId = randomPublicId();
    await enqueueOutboxOp(scope, {
      id: opId,
      moduleId: MODULE_ID,
      method: "diary.blockDelete",
      payload: { subject_kind: subjectKind, id: blockId, client_op_id: opId },
      createdAt: now,
    });
    scheduleFlush(scope);
  };

  if (await unresolvedTempId(scope, blockId)) {
    return doOffline();
  }

  return preferOnlineWrite(async () => {
    const opId = randomPublicId();
    await habitat().call("diary.blockDelete", {
      subject_kind: subjectKind,
      id: blockId,
      client_op_id: opId,
    });
    const entry = await findLocalEntry(scope, subjectKind, parentId);
    if (entry) {
      await upsertLocalEntry(scope, subjectKind, {
        ...entry,
        blocks: entry.blocks.filter((b) => b.id !== blockId),
        updated_at: new Date().toISOString(),
      });
    }
  }, doOffline);
}

export async function offlineReorderDiaryBlocks(
  subjectKind: DiarySubjectKind,
  parentId: number,
  items: Array<{ id: number; sort_order: number }>,
): Promise<DiaryTextBlock[]> {
  const scope = resolveOutboxScope();
  const existing = await findLocalEntry(scope, subjectKind, parentId);
  if (!existing) throw new Error("diary entry not found locally");

  const doOffline = async (): Promise<DiaryTextBlock[]> => {
    const order = new Map(items.map((i) => [i.id, i.sort_order]));
    const now = new Date().toISOString();
    const blocks = existing.blocks
      .map((b) => {
        const nextOrder = order.get(b.id);
        return nextOrder != null ? { ...b, sort_order: nextOrder, updated_at: now } : b;
      })
      .toSorted((a, b) => a.sort_order - b.sort_order || a.id - b.id);
    await upsertLocalEntry(scope, subjectKind, { ...existing, blocks, updated_at: now });

    const opId = randomPublicId();
    await enqueueOutboxOp(scope, {
      id: opId,
      moduleId: MODULE_ID,
      method: "diary.blockReorder",
      payload: { subject_kind: subjectKind, items },
      createdAt: now,
    });
    scheduleFlush(scope);
    return blocks;
  };

  if (items.some((i) => isTempId(i.id)) || (await unresolvedTempId(scope, existing.id))) {
    return doOffline();
  }

  return preferOnlineWrite(async () => {
    const data = await habitat().call("diary.blockReorder", {
      subject_kind: subjectKind,
      items,
    });
    await upsertLocalEntry(scope, subjectKind, {
      ...existing,
      blocks: data.items,
      updated_at: new Date().toISOString(),
    });
    return data.items;
  }, doOffline);
}

export async function offlineDeleteDiaryEntry(
  subjectKind: DiarySubjectKind,
  id: number,
): Promise<void> {
  const scope = resolveOutboxScope();
  const existing = await findLocalEntry(scope, subjectKind, id);
  const resolvedId = existing?.id ?? (await resolveEntityId(scope, id));

  const doOffline = async (): Promise<void> => {
    await removeLocalEntry(scope, subjectKind, resolvedId);
    if (resolvedId !== id) await removeLocalEntry(scope, subjectKind, id);

    if (isTempId(resolvedId) || isTempId(id)) {
      const tempIds = new Set([id, resolvedId].filter(isTempId));
      const ops = await listOutboxOps(scope, MODULE_ID);
      for (const op of ops) {
        if (
          (typeof op.tempEntityId === "number" && tempIds.has(op.tempEntityId)) ||
          (typeof op.payload.id === "number" &&
            (tempIds.has(op.payload.id) || op.payload.id === resolvedId)) ||
          (typeof op.payload.parent_id === "number" && tempIds.has(op.payload.parent_id))
        ) {
          await removeOutboxOp(scope, op.id);
        }
      }
      return;
    }

    const opId = randomPublicId();
    await enqueueOutboxOp(scope, {
      id: opId,
      moduleId: MODULE_ID,
      method: "diary.delete",
      payload: { subject_kind: subjectKind, id: resolvedId, client_op_id: opId },
      createdAt: new Date().toISOString(),
    });
    scheduleFlush(scope);
  };

  if (await unresolvedTempId(scope, resolvedId)) {
    return doOffline();
  }

  return preferOnlineWrite(async () => {
    const opId = randomPublicId();
    await habitat().call("diary.delete", {
      subject_kind: subjectKind,
      id: resolvedId,
      client_op_id: opId,
    });
    await removeLocalEntry(scope, subjectKind, resolvedId);
    if (resolvedId !== id) await removeLocalEntry(scope, subjectKind, id);
  }, doOffline);
}

export async function countDiaryPendingOps(): Promise<number> {
  return listOutboxOps(resolveOutboxScope(), MODULE_ID).then((ops) => ops.length);
}

export { resolveHabitatCacheScope };
