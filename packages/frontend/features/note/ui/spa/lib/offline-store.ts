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
import { getUserSubjectId } from "@freeanima/client/portal-sdk/world-context.ts";
import { randomPublicId } from "@freeanima/shared/util";
import type {
  NoteRowPayload,
  NoteTextBlockPayload,
} from "@freeanima/shared/rpc-contract/frames/note.ts";

export type NoteRow = NoteRowPayload;
export type NoteTextBlock = NoteTextBlockPayload;

const MODULE_ID = "note";
const NAMESPACE = "note";

function listCacheId(subjectId: number): string {
  return `list:${subjectId}`;
}

function noteCacheId(subjectId: number, id: number): string {
  return `note:${subjectId}:${id}`;
}

function sortNotes(items: NoteRow[]): NoteRow[] {
  return items.toSorted((a, b) => b.updated_at.localeCompare(a.updated_at) || b.id - a.id);
}

async function readLocalList(scope: string, subjectId: number): Promise<NoteRow[]> {
  const cached = await readOfflineCache<NoteRow[]>(scope, NAMESPACE, listCacheId(subjectId));
  return cached ?? [];
}

async function writeLocalList(scope: string, subjectId: number, items: NoteRow[]): Promise<void> {
  await writeOfflineCache(scope, NAMESPACE, listCacheId(subjectId), sortNotes(items));
}

async function upsertLocalNote(scope: string, subjectId: number, note: NoteRow): Promise<void> {
  const list = await readLocalList(scope, subjectId);
  const next = list.filter((e) => e.id !== note.id);
  next.unshift(note);
  await writeLocalList(scope, subjectId, next);
  await writeOfflineCache(scope, NAMESPACE, noteCacheId(subjectId, note.id), note);
}

async function removeLocalNote(scope: string, subjectId: number, id: number): Promise<void> {
  const list = await readLocalList(scope, subjectId);
  await writeLocalList(
    scope,
    subjectId,
    list.filter((e) => e.id !== id),
  );
}

async function rewriteLocalNoteId(
  scope: string,
  subjectId: number,
  tempId: number,
  serverId: number,
  serverRow?: NoteRow,
): Promise<void> {
  const list = await readLocalList(scope, subjectId);
  const existing = list.find((e) => e.id === tempId);
  const rewritten: NoteRow = serverRow
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
          tag_ids: [],
          blocks: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
  const next = list.filter((e) => e.id !== tempId && e.id !== serverId);
  next.unshift(rewritten);
  await writeLocalList(scope, subjectId, next);
  await writeOfflineCache(scope, NAMESPACE, noteCacheId(subjectId, serverId), rewritten);
}

async function resolveEntityId(scope: string, id: number): Promise<number> {
  if (!isTempId(id)) return id;
  const mapped = await getIdMapping(scope, MODULE_ID, id);
  return mapped ?? id;
}

export async function findLocalNote(
  scope: string,
  subjectId: number,
  id: number,
): Promise<NoteRow | undefined> {
  const resolvedId = await resolveEntityId(scope, id);
  const byId = await readOfflineCache<NoteRow>(
    scope,
    NAMESPACE,
    noteCacheId(subjectId, resolvedId),
  );
  if (byId) return byId;
  if (resolvedId !== id) {
    const byTemp = await readOfflineCache<NoteRow>(scope, NAMESPACE, noteCacheId(subjectId, id));
    if (byTemp) return byTemp;
  }
  const list = await readLocalList(scope, subjectId);
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

async function unresolvedTempId(scope: string, id: number): Promise<boolean> {
  if (!isTempId(id)) return false;
  return (await getIdMapping(scope, MODULE_ID, id)) == null;
}

async function pendingTempNoteIds(scope: string): Promise<Set<number>> {
  const ops = await listOutboxOps(scope, MODULE_ID);
  const ids = new Set<number>();
  for (const op of ops) {
    if (op.method === "note.create" && typeof op.tempEntityId === "number") {
      ids.add(op.tempEntityId);
    }
  }
  return ids;
}

async function mergeServerList(
  scope: string,
  subjectId: number,
  serverItems: NoteRow[],
): Promise<NoteRow[]> {
  const local = await readLocalList(scope, subjectId);
  const localById = new Map(local.map((e) => [e.id, e]));
  // note.list 故意不带 blocks（空数组=未加载）；勿覆盖本地已缓存的块
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

  const tempIds = await pendingTempNoteIds(scope);
  if (tempIds.size === 0) return withBlocks;
  const serverIds = new Set(withBlocks.map((e) => e.id));
  const pendingTemps = local.filter((e) => tempIds.has(e.id) && !serverIds.has(e.id));
  if (pendingTemps.length === 0) return withBlocks;
  return sortNotes([...pendingTemps, ...withBlocks]);
}

export async function reconcileServerNoteList(
  subjectId: number,
  serverItems: NoteRow[],
): Promise<NoteRow[]> {
  return mergeServerList(resolveOutboxScope(), subjectId, serverItems);
}

export function compactNoteOutbox(ops: OfflineOutboxOp[]): OfflineOutboxOp[] {
  const byTemp = new Map<number, OfflineOutboxOp>();
  const result: OfflineOutboxOp[] = [];

  for (const op of ops) {
    if (op.method === "note.delete") {
      const id = op.payload.id;
      if (typeof id === "number" && isTempId(id)) {
        byTemp.delete(id);
        continue;
      }
      result.push(op);
      continue;
    }

    if (op.method === "note.create" && op.tempEntityId != null) {
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

    if (op.method === "note.patch") {
      const id = op.payload.id;
      if (typeof id === "number" && isTempId(id)) {
        const createOp = byTemp.get(id);
        if (createOp) {
          const payload = { ...createOp.payload, ...op.payload };
          delete payload.id;
          byTemp.set(id, { ...createOp, payload, createdAt: op.createdAt });
          continue;
        }
      }
    }

    result.push(op);
  }

  return [...byTemp.values(), ...result].toSorted((a, b) => a.createdAt.localeCompare(b.createdAt));
}

async function flushNoteOp(
  op: OfflineOutboxOp,
  scope: string,
): Promise<import("@freeanima/client/portal-sdk/offline-module-types").FlushOpOutcome> {
  try {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- as never 类型对齐边界
    const result = (await habitat().call(op.method as never, op.payload as never)) as {
      item?: NoteRow | NoteTextBlock;
    };
    if (
      op.tempEntityId != null &&
      op.method === "note.create" &&
      result.item &&
      "blocks" in result.item
    ) {
      const subjectId = typeof op.payload.subject_id === "number" ? op.payload.subject_id : 0;
      await recordFlushIdMapping(scope, MODULE_ID, op.tempEntityId, result.item.id);
      await rewriteLocalNoteId(scope, subjectId, op.tempEntityId, result.item.id, result.item);
    }
    if (
      op.tempEntityId != null &&
      op.method === "note.blockCreate" &&
      result.item &&
      "parent_id" in result.item &&
      !("blocks" in result.item)
    ) {
      const subjectId = typeof op.payload.subject_id === "number" ? op.payload.subject_id : 0;
      await recordFlushIdMapping(scope, MODULE_ID, op.tempEntityId, result.item.id);
      const parentId =
        typeof op.payload.parent_id === "number" ? op.payload.parent_id : result.item.parent_id;
      const note = await findLocalNote(scope, subjectId, parentId);
      if (note) {
        const blocks = note.blocks
          .filter((b) => b.id !== op.tempEntityId)
          .concat([{ ...result.item }])
          .toSorted((a, b) => a.sort_order - b.sort_order || a.id - b.id);
        await upsertLocalNote(scope, subjectId, { ...note, blocks });
      }
    }
    return { status: "done" };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { status: "failed", error: message };
  }
}

export const noteRpcAdapter: RpcModuleAdapter = {
  kind: "rpc",
  moduleId: MODULE_ID,
  ordering: "fifo",
  compactOutbox: compactNoteOutbox,
  resolvePayloadIds: (payload, idMap) => resolveIdFields(payload, idMap, ["id", "parent_id"]),
  flushOp: async (op, ctx) => flushNoteOp(op, ctx.scope),
  refreshAll: async (scope) => {
    try {
      const subjectId = await getUserSubjectId();
      const data = await habitat().call("note.list", {
        subject_id: subjectId,
        limit: 200,
      });
      const merged = await mergeServerList(scope, subjectId, data.items);
      await writeLocalList(scope, subjectId, merged);
    } catch {
      /* keep local snapshot */
    }
  },
};

export function registerNoteOfflineModule(): void {
  registerOfflineModule(noteRpcAdapter);
  registerOfflineModuleCap(MODULE_ID, { offlineWritable: true });
  void ensureAllocatorSeeded(resolveOutboxScope()).catch(() => {});
}

export async function offlineCreateNote(
  subjectId: number,
  input: { title: string; content?: string; summary?: string; tag_ids?: number[] },
): Promise<NoteRow> {
  const title = input.title.trim();
  if (title.length === 0) throw new Error("note title is required");
  const content = input.content?.trim() || undefined;
  const payload = {
    title,
    ...(content ? { content } : {}),
    ...(input.summary !== undefined ? { summary: input.summary } : {}),
    ...(input.tag_ids !== undefined ? { tag_ids: input.tag_ids } : {}),
  };

  return preferOnlineWrite(
    async () => {
      const scope = resolveOutboxScope();
      const opId = randomPublicId();
      const data = await habitat().call("note.create", {
        subject_id: subjectId,
        client_op_id: opId,
        ...payload,
      });
      await upsertLocalNote(scope, subjectId, data.item);
      return data.item;
    },
    async () => {
      const scope = resolveOutboxScope();
      await ensureAllocatorSeeded(scope);
      const tempId = allocateTempId(scope, MODULE_ID);
      const opId = randomPublicId();
      const now = new Date().toISOString();
      const blocks: NoteTextBlock[] = content
        ? [
            {
              id: allocateTempId(scope, MODULE_ID),
              title: "",
              content,
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
      const row: NoteRow = {
        id: tempId,
        title,
        summary: input.summary ?? "",
        tag_ids: input.tag_ids ?? [],
        blocks,
        created_at: now,
        updated_at: now,
      };
      await upsertLocalNote(scope, subjectId, row);
      await enqueueOutboxOp(scope, {
        id: opId,
        moduleId: MODULE_ID,
        method: "note.create",
        payload: {
          subject_id: subjectId,
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

export async function offlineUpdateNote(
  subjectId: number,
  id: number,
  patch: { title?: string; summary?: string; tag_ids?: number[] },
): Promise<NoteRow> {
  const scope = resolveOutboxScope();
  const existing = await findLocalNote(scope, subjectId, id);
  if (!existing) throw new Error("note not found locally");
  const resolvedId = existing.id;

  const doOffline = async (): Promise<NoteRow> => {
    const now = new Date().toISOString();
    const updated: NoteRow = {
      ...existing,
      ...patch,
      updated_at: now,
    };
    await upsertLocalNote(scope, subjectId, updated);

    const opId = randomPublicId();
    await enqueueOutboxOp(scope, {
      id: opId,
      moduleId: MODULE_ID,
      method: "note.patch",
      payload: {
        subject_id: subjectId,
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
    const data = await habitat().call("note.patch", {
      subject_id: subjectId,
      id: resolvedId,
      client_op_id: opId,
      ...patch,
    });
    await upsertLocalNote(scope, subjectId, data.item);
    return data.item;
  }, doOffline);
}

export async function offlineDeleteNote(subjectId: number, id: number): Promise<void> {
  const scope = resolveOutboxScope();
  const existing = await findLocalNote(scope, subjectId, id);
  const resolvedId = existing?.id ?? (await resolveEntityId(scope, id));

  const doOffline = async (): Promise<void> => {
    await removeLocalNote(scope, subjectId, resolvedId);
    if (resolvedId !== id) await removeLocalNote(scope, subjectId, id);

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
      method: "note.delete",
      payload: { subject_id: subjectId, id: resolvedId, client_op_id: opId },
      createdAt: new Date().toISOString(),
    });
    scheduleFlush(scope);
  };

  if (await unresolvedTempId(scope, resolvedId)) {
    return doOffline();
  }

  return preferOnlineWrite(async () => {
    const opId = randomPublicId();
    await habitat().call("note.delete", {
      subject_id: subjectId,
      id: resolvedId,
      client_op_id: opId,
    });
    await removeLocalNote(scope, subjectId, resolvedId);
    if (resolvedId !== id) await removeLocalNote(scope, subjectId, id);
  }, doOffline);
}

export async function offlineCreateNoteBlock(
  subjectId: number,
  parentId: number,
  content: string,
): Promise<NoteTextBlock> {
  const scope = resolveOutboxScope();
  await ensureAllocatorSeeded(scope);
  const existing = await findLocalNote(scope, subjectId, parentId);
  if (!existing) throw new Error("note not found locally");
  const resolvedParentId = existing.id;

  const doOffline = async (): Promise<NoteTextBlock> => {
    const now = new Date().toISOString();
    const last = existing.blocks.toSorted((a, b) => a.sort_order - b.sort_order).at(-1);
    const tempId = allocateTempId(scope, MODULE_ID);
    const opId = randomPublicId();
    const block: NoteTextBlock = {
      id: tempId,
      title: "",
      content,
      sort_order: last ? last.sort_order + 1 : 0,
      parent_id: resolvedParentId,
      client_op_id: opId,
      components: ["content_block"],
      tag_ids: [],
      created_at: now,
      updated_at: now,
    };
    await upsertLocalNote(scope, subjectId, {
      ...existing,
      blocks: [...existing.blocks, block],
      updated_at: now,
    });
    await enqueueOutboxOp(scope, {
      id: opId,
      moduleId: MODULE_ID,
      method: "note.blockCreate",
      payload: {
        subject_id: subjectId,
        parent_id: resolvedParentId,
        content: block.content,
        title: block.title,
        sort_order: block.sort_order,
        client_op_id: opId,
      },
      tempEntityId: tempId,
      ...(isTempId(resolvedParentId)
        ? { dependsOn: [{ tempId: resolvedParentId, field: "parent_id" }] }
        : {}),
      createdAt: now,
    });
    scheduleFlush(scope);
    return block;
  };

  if (await unresolvedTempId(scope, resolvedParentId)) {
    return doOffline();
  }

  return preferOnlineWrite(async () => {
    const opId = randomPublicId();
    const data = await habitat().call("note.blockCreate", {
      subject_id: subjectId,
      parent_id: resolvedParentId,
      content,
      client_op_id: opId,
    });
    const note = await findLocalNote(scope, subjectId, resolvedParentId);
    if (note) {
      const blocks = note.blocks
        .concat([data.item])
        .toSorted((a, b) => a.sort_order - b.sort_order || a.id - b.id);
      await upsertLocalNote(scope, subjectId, {
        ...note,
        blocks,
        updated_at: new Date().toISOString(),
      });
    }
    return data.item;
  }, doOffline);
}

export async function offlineUpdateNoteBlock(
  subjectId: number,
  id: number,
  patch: { content?: string; title?: string },
): Promise<NoteTextBlock> {
  const scope = resolveOutboxScope();
  const resolvedId = await resolveEntityId(scope, id);
  const list = await readLocalList(scope, subjectId);
  let parent: NoteRow | undefined;
  let block: NoteTextBlock | undefined;
  for (const note of list) {
    const found = note.blocks.find((b) => b.id === resolvedId || b.id === id);
    if (found) {
      parent = note;
      block = found;
      break;
    }
  }
  if (!parent) {
    const cached = await findLocalNote(scope, subjectId, resolvedId);
    if (cached) {
      const found = cached.blocks.find((b) => b.id === resolvedId || b.id === id);
      if (found) {
        parent = cached;
        block = found;
      }
    }
  }
  if (!parent || !block) throw new Error("note block not found locally");
  const localParent = parent;
  const localBlock = block;
  const localBlockId = localBlock.id;

  const doOffline = async (): Promise<NoteTextBlock> => {
    const now = new Date().toISOString();
    const updatedBlock: NoteTextBlock = {
      ...localBlock,
      ...patch,
      id: localBlockId,
      updated_at: now,
    };
    await upsertLocalNote(scope, subjectId, {
      ...localParent,
      blocks: localParent.blocks.map((b) => (b.id === localBlockId ? updatedBlock : b)),
      updated_at: now,
    });

    const opId = randomPublicId();
    await enqueueOutboxOp(scope, {
      id: opId,
      moduleId: MODULE_ID,
      method: "note.blockPatch",
      payload: {
        subject_id: subjectId,
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
    const data = await habitat().call("note.blockPatch", {
      subject_id: subjectId,
      id: resolvedId,
      client_op_id: opId,
      ...patch,
    });
    const note = await findLocalNote(scope, subjectId, localParent.id);
    if (note) {
      await upsertLocalNote(scope, subjectId, {
        ...note,
        blocks: note.blocks.map((b) => (b.id === localBlockId ? data.item : b)),
        updated_at: new Date().toISOString(),
      });
    }
    return data.item;
  }, doOffline);
}

export async function offlineDeleteNoteBlock(subjectId: number, blockId: number): Promise<void> {
  const scope = resolveOutboxScope();
  const resolvedId = await resolveEntityId(scope, blockId);
  const list = await readLocalList(scope, subjectId);
  let parent: NoteRow | undefined;
  for (const note of list) {
    if (note.blocks.some((b) => b.id === resolvedId || b.id === blockId)) {
      parent = note;
      break;
    }
  }
  if (!parent) {
    throw new Error("note block not found locally");
  }
  const existing = parent;

  const doOffline = async (): Promise<void> => {
    const now = new Date().toISOString();
    await upsertLocalNote(scope, subjectId, {
      ...existing,
      blocks: existing.blocks.filter((b) => b.id !== blockId && b.id !== resolvedId),
      updated_at: now,
    });

    if (isTempId(blockId) || isTempId(resolvedId)) {
      const tempIds = new Set([blockId, resolvedId].filter(isTempId));
      const ops = await listOutboxOps(scope, MODULE_ID);
      for (const op of ops) {
        if (typeof op.tempEntityId === "number" && tempIds.has(op.tempEntityId)) {
          await removeOutboxOp(scope, op.id);
        }
      }
      return;
    }

    const opId = randomPublicId();
    await enqueueOutboxOp(scope, {
      id: opId,
      moduleId: MODULE_ID,
      method: "note.blockDelete",
      payload: { subject_id: subjectId, id: resolvedId, client_op_id: opId },
      createdAt: now,
    });
    scheduleFlush(scope);
  };

  if (await unresolvedTempId(scope, resolvedId)) {
    return doOffline();
  }

  return preferOnlineWrite(async () => {
    const opId = randomPublicId();
    await habitat().call("note.blockDelete", {
      subject_id: subjectId,
      id: resolvedId,
      client_op_id: opId,
    });
    const note = await findLocalNote(scope, subjectId, existing.id);
    if (note) {
      await upsertLocalNote(scope, subjectId, {
        ...note,
        blocks: note.blocks.filter((b) => b.id !== blockId && b.id !== resolvedId),
        updated_at: new Date().toISOString(),
      });
    }
  }, doOffline);
}

export async function countNotePendingOps(): Promise<number> {
  return listOutboxOps(resolveOutboxScope(), MODULE_ID).then((ops) => ops.length);
}

export { resolveHabitatCacheScope };
