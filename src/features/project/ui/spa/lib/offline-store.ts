import { getSubjectKind } from "@freeanima/frontend/shell-sdk";
import { getIdMapping, resolveIdFields } from "@freeanima/frontend/shell-sdk/offline-id-map";
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
import {
  allocateTempId,
  isTempId,
  seedTempIdAllocatorFromIdMap,
} from "@freeanima/frontend/shell-sdk/offline-temp-id";
import { preferOnlineWrite } from "@freeanima/frontend/shell-sdk/prefer-online-write";
import { formatCstIso } from "@freeanima/core/util/time";
import { omitUndefined } from "@freeanima/core/util";
import { getTypedHabitatClient } from "@freeanima/platform/habitat/client.ts";
import { randomUuid } from "@freeanima/shared/rpc-contract";

import type { ProjectFolderRow, ProjectRow, TaskItemRow } from "./api.ts";
import {
  readCachedProjectFolders,
  readCachedProjectItems,
  readCachedProjects,
  writeCachedProjectFolders,
  writeCachedProjectItems,
  writeCachedProjects,
} from "./offline-cache.ts";

const MODULE_ID = "project";

function subjectPayload(): { subject_kind: ReturnType<typeof getSubjectKind> } {
  return { subject_kind: getSubjectKind() };
}

async function readLocalFolders(scope: string): Promise<ProjectFolderRow[]> {
  return (await readCachedProjectFolders(scope)) ?? [];
}

async function writeLocalFolders(scope: string, folders: ProjectFolderRow[]): Promise<void> {
  const sorted = folders.toSorted((a, b) => a.sort_order - b.sort_order || a.id - b.id);
  await writeCachedProjectFolders(scope, sorted);
}

async function readLocalProjects(scope: string): Promise<ProjectRow[]> {
  return (await readCachedProjects(scope)) ?? [];
}

async function writeLocalProjects(scope: string, projects: ProjectRow[]): Promise<void> {
  const sorted = projects.toSorted((a, b) => a.sort_order - b.sort_order || a.id - b.id);
  await writeCachedProjects(scope, sorted);
}

async function readLocalItems(scope: string, projectId: number): Promise<TaskItemRow[]> {
  return (await readCachedProjectItems(scope, projectId)) ?? [];
}

async function writeLocalItems(
  scope: string,
  projectId: number,
  items: TaskItemRow[],
): Promise<void> {
  const sorted = items.toSorted((a, b) => a.sort_order - b.sort_order || a.id - b.id);
  await writeCachedProjectItems(scope, projectId, sorted);
}

async function upsertLocalFolder(scope: string, folder: ProjectFolderRow): Promise<void> {
  const folders = await readLocalFolders(scope);
  const next = folders.filter((row) => row.id !== folder.id);
  next.push(folder);
  await writeLocalFolders(scope, next);
}

async function removeLocalFolder(scope: string, id: number): Promise<void> {
  const folders = await readLocalFolders(scope);
  await writeLocalFolders(
    scope,
    folders.filter((row) => row.id !== id),
  );
}

async function upsertLocalProject(scope: string, project: ProjectRow): Promise<void> {
  const projects = await readLocalProjects(scope);
  const next = projects.filter((row) => row.id !== project.id);
  next.push(project);
  await writeLocalProjects(scope, next);
}

async function removeLocalProject(scope: string, id: number): Promise<void> {
  const projects = await readLocalProjects(scope);
  await writeLocalProjects(
    scope,
    projects.filter((row) => row.id !== id),
  );
  await writeCachedProjectItems(scope, id, []);
}

async function upsertLocalItem(scope: string, item: TaskItemRow): Promise<void> {
  if (item.project_id == null) return;
  const items = await readLocalItems(scope, item.project_id);
  const next = items.filter((row) => row.id !== item.id);
  next.push(item);
  await writeLocalItems(scope, item.project_id, next);
}

async function removeLocalItem(scope: string, projectId: number, id: number): Promise<void> {
  const items = await readLocalItems(scope, projectId);
  await writeLocalItems(
    scope,
    projectId,
    items.filter((row) => row.id !== id),
  );
}

async function adjustProjectTaskCount(
  scope: string,
  projectId: number,
  delta: number,
): Promise<void> {
  if (delta === 0) return;
  const projects = await readLocalProjects(scope);
  const idx = projects.findIndex((row) => row.id === projectId);
  if (idx < 0) return;
  const project = projects[idx];
  if (!project) return;
  projects[idx] = { ...project, task_count: Math.max(0, (project.task_count ?? 0) + delta) };
  await writeLocalProjects(scope, projects);
}

async function pendingTempIds(scope: string, methods: string[]): Promise<Set<number>> {
  const methodSet = new Set(methods);
  const ops = await listOutboxOps(scope, MODULE_ID);
  const ids = new Set<number>();
  for (const op of ops) {
    if (methodSet.has(op.method) && typeof op.tempEntityId === "number") {
      ids.add(op.tempEntityId);
    }
  }
  return ids;
}

async function ensureAllocatorSeeded(scope: string): Promise<void> {
  await seedTempIdAllocatorFromIdMap(scope, MODULE_ID);
}

async function resolveEntityId(scope: string, id: number): Promise<number> {
  if (!isTempId(id)) return id;
  const mapped = await getIdMapping(scope, MODULE_ID, id);
  return mapped ?? id;
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

async function rewriteLocalFolderId(
  scope: string,
  tempId: number,
  serverId: number,
  serverRow?: ProjectFolderRow,
): Promise<void> {
  const folders = await readLocalFolders(scope);
  const existing = folders.find((row) => row.id === tempId);
  const rewritten: ProjectFolderRow = serverRow
    ? { ...serverRow }
    : existing
      ? { ...existing, id: serverId }
      : {
          id: serverId,
          name: "",
          parent_id: null,
          sort_order: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
  const next = folders
    .filter((row) => row.id !== tempId && row.id !== serverId)
    .map((row) => (row.parent_id === tempId ? { ...row, parent_id: serverId } : row));
  next.push(rewritten);
  await writeLocalFolders(scope, next);

  const projects = await readLocalProjects(scope);
  const remapped = projects.map((row) =>
    row.folder_id === tempId ? { ...row, folder_id: serverId } : row,
  );
  await writeLocalProjects(scope, remapped);
}

async function rewriteLocalProjectId(
  scope: string,
  tempId: number,
  serverId: number,
  serverRow?: ProjectRow,
): Promise<void> {
  const projects = await readLocalProjects(scope);
  const existing = projects.find((row) => row.id === tempId);
  const rewritten: ProjectRow = serverRow
    ? { ...serverRow }
    : existing
      ? { ...existing, id: serverId }
      : {
          id: serverId,
          title: "",
          content: "",
          folder_id: null,
          start_at: null,
          end_at: null,
          status: "active",
          product_tag: null,
          sort_order: 0,
          task_count: 0,
          linked_diary_ids: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
  const next = projects.filter((row) => row.id !== tempId && row.id !== serverId);
  next.push(rewritten);
  await writeLocalProjects(scope, next);

  const items = await readLocalItems(scope, tempId);
  if (items.length > 0) {
    await writeLocalItems(
      scope,
      serverId,
      items.map((row) => ({ ...row, project_id: serverId })),
    );
    await writeCachedProjectItems(scope, tempId, []);
  }
}

async function rewriteLocalItemId(
  scope: string,
  tempId: number,
  serverId: number,
  serverRow?: TaskItemRow,
): Promise<void> {
  const projects = await readLocalProjects(scope);
  for (const project of projects) {
    const items = await readLocalItems(scope, project.id);
    const existing = items.find((row) => row.id === tempId);
    if (!existing && !serverRow) continue;
    const rewritten: TaskItemRow = serverRow
      ? { ...serverRow }
      : existing
        ? { ...existing, id: serverId }
        : {
            id: serverId,
            title: "",
            content: "",
            tag_ids: [],
            status: "pending",
            priority: "none",
            due_at: null,
            remind_at: null,
            list_id: null,
            project_id: project.id,
            sort_order: 0,
            completed_at: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
    const next = items.filter((row) => row.id !== tempId && row.id !== serverId);
    next.push(rewritten);
    await writeLocalItems(scope, project.id, next);
    return;
  }
  if (serverRow?.project_id != null) await upsertLocalItem(scope, serverRow);
}

async function findLocalItem(
  scope: string,
  id: number,
): Promise<{ item: TaskItemRow; projectId: number } | null> {
  const resolvedId = await resolveEntityId(scope, id);
  const projects = await readLocalProjects(scope);
  for (const project of projects) {
    const items = await readLocalItems(scope, project.id);
    const found =
      items.find((row) => row.id === resolvedId) ??
      (resolvedId !== id ? items.find((row) => row.id === id) : undefined);
    if (found) return { item: found, projectId: project.id };
  }
  return null;
}

async function mergeServerFolders(
  scope: string,
  serverFolders: ProjectFolderRow[],
): Promise<ProjectFolderRow[]> {
  const tempIds = await pendingTempIds(scope, ["projectfolder.create"]);
  if (tempIds.size === 0) return serverFolders;
  const local = await readLocalFolders(scope);
  const serverIds = new Set(serverFolders.map((row) => row.id));
  const pendingTemps = local.filter((row) => tempIds.has(row.id) && !serverIds.has(row.id));
  if (pendingTemps.length === 0) return serverFolders;
  return [...pendingTemps, ...serverFolders].toSorted(
    (a, b) => a.sort_order - b.sort_order || a.id - b.id,
  );
}

async function mergeServerProjects(
  scope: string,
  serverProjects: ProjectRow[],
): Promise<ProjectRow[]> {
  const tempIds = await pendingTempIds(scope, ["project.create"]);
  const local = await readLocalProjects(scope);
  const serverIds = new Set(serverProjects.map((row) => row.id));
  const pendingTemps =
    tempIds.size === 0 ? [] : local.filter((row) => tempIds.has(row.id) && !serverIds.has(row.id));
  const base = pendingTemps.length === 0 ? serverProjects : [...pendingTemps, ...serverProjects];
  return applyPendingProjectPatches(scope, base);
}

async function applyPendingProjectPatches(
  scope: string,
  projects: ProjectRow[],
): Promise<ProjectRow[]> {
  const ops = await listOutboxOps(scope, MODULE_ID);
  if (ops.length === 0) return projects;
  const byId = new Map(projects.map((row) => [row.id, { ...row }]));
  for (const op of ops) {
    if (op.method !== "project.patch") continue;
    const id = op.payload.id;
    if (typeof id !== "number") continue;
    const row = byId.get(id);
    if (!row) continue;
    const patch = op.payload;
    byId.set(id, {
      ...row,
      ...(typeof patch.title === "string" ? { title: patch.title } : {}),
      ...(patch.start_at === null || typeof patch.start_at === "string"
        ? { start_at: patch.start_at }
        : {}),
      ...(patch.end_at === null || typeof patch.end_at === "string"
        ? { end_at: patch.end_at }
        : {}),
      ...(typeof patch.content === "string" ? { content: patch.content } : {}),
      ...(typeof patch.status === "string" ? { status: patch.status as ProjectRow["status"] } : {}),
      ...(typeof patch.sort_order === "number" ? { sort_order: patch.sort_order } : {}),
      ...(patch.folder_id === null || typeof patch.folder_id === "number"
        ? { folder_id: patch.folder_id }
        : {}),
    });
  }
  return [...byId.values()].toSorted((a, b) => a.sort_order - b.sort_order || a.id - b.id);
}

async function mergeServerItems(
  scope: string,
  projectId: number,
  serverItems: TaskItemRow[],
): Promise<TaskItemRow[]> {
  const tempIds = await pendingTempIds(scope, ["project.item.create"]);
  if (tempIds.size === 0) return serverItems;
  const local = await readLocalItems(scope, projectId);
  const serverIds = new Set(serverItems.map((row) => row.id));
  const pendingTemps = local.filter((row) => tempIds.has(row.id) && !serverIds.has(row.id));
  if (pendingTemps.length === 0) return serverItems;
  return [...pendingTemps, ...serverItems].toSorted(
    (a, b) => a.sort_order - b.sort_order || a.id - b.id,
  );
}

export async function reconcileServerProjectFolders(
  serverFolders: ProjectFolderRow[],
): Promise<ProjectFolderRow[]> {
  return mergeServerFolders(resolveOutboxScope(), serverFolders);
}

export async function reconcileServerProjects(serverProjects: ProjectRow[]): Promise<ProjectRow[]> {
  return mergeServerProjects(resolveOutboxScope(), serverProjects);
}

export async function reconcileServerProjectItems(
  projectId: number,
  serverItems: TaskItemRow[],
): Promise<TaskItemRow[]> {
  return mergeServerItems(resolveOutboxScope(), projectId, serverItems);
}

function mergePatchIntoCreate(
  createOp: OfflineOutboxOp,
  patchOp: OfflineOutboxOp,
): OfflineOutboxOp {
  const payload = { ...createOp.payload };
  const patch = { ...patchOp.payload };
  delete patch.id;
  Object.assign(payload, patch);
  return { ...createOp, payload, createdAt: patchOp.createdAt };
}

export function compactProjectOutbox(ops: OfflineOutboxOp[]): OfflineOutboxOp[] {
  const byTemp = new Map<number, OfflineOutboxOp>();
  const result: OfflineOutboxOp[] = [];

  for (const op of ops) {
    if (
      op.method === "projectfolder.delete" ||
      op.method === "project.delete" ||
      op.method === "task.delete"
    ) {
      const id = op.payload.id;
      if (typeof id === "number" && isTempId(id)) {
        byTemp.delete(id);
        continue;
      }
      result.push(op);
      continue;
    }

    if (
      (op.method === "projectfolder.create" ||
        op.method === "project.create" ||
        op.method === "project.item.create") &&
      op.tempEntityId != null
    ) {
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

    if (
      op.method === "projectfolder.patch" ||
      op.method === "project.patch" ||
      op.method === "task.patch"
    ) {
      const id = op.payload.id;
      if (typeof id === "number" && isTempId(id)) {
        const createOp = byTemp.get(id);
        if (createOp) {
          byTemp.set(id, mergePatchIntoCreate(createOp, op));
          continue;
        }
      }
    }

    result.push(op);
  }

  return [...byTemp.values(), ...result].toSorted((a, b) => a.createdAt.localeCompare(b.createdAt));
}

async function flushProjectOp(
  op: OfflineOutboxOp,
  scope: string,
): Promise<import("@freeanima/frontend/shell-sdk/offline-module-types").FlushOpOutcome> {
  try {
    const result = (await habitat().call(op.method as "project.create", op.payload as never)) as {
      item?: ProjectFolderRow | ProjectRow | TaskItemRow;
      ok?: true;
    };
    if (op.tempEntityId != null && result.item?.id) {
      await recordFlushIdMapping(scope, MODULE_ID, op.tempEntityId, result.item.id);
      if (op.method === "projectfolder.create") {
        await rewriteLocalFolderId(
          scope,
          op.tempEntityId,
          result.item.id,
          result.item as ProjectFolderRow,
        );
      } else if (op.method === "project.create") {
        await rewriteLocalProjectId(
          scope,
          op.tempEntityId,
          result.item.id,
          result.item as ProjectRow,
        );
      } else if (op.method === "project.item.create") {
        await rewriteLocalItemId(
          scope,
          op.tempEntityId,
          result.item.id,
          result.item as TaskItemRow,
        );
      }
    }
    return { status: "done" };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { status: "failed", error: message };
  }
}

export const projectRpcAdapter: RpcModuleAdapter = {
  kind: "rpc",
  moduleId: MODULE_ID,
  ordering: "topological",
  compactOutbox: compactProjectOutbox,
  resolvePayloadIds: (payload, idMap) =>
    resolveIdFields(payload, idMap, ["id", "folder_id", "parent_id", "project_id"]),
  flushOp: async (op, ctx) => flushProjectOp(op, ctx.scope),
  refreshAll: async (scope) => {
    const localProjects = await readLocalProjects(scope);
    const cachedProjectIds = localProjects.map((row) => row.id);

    try {
      const folderData = await habitat().call("projectfolder.list", { ...subjectPayload() });
      const mergedFolders = await mergeServerFolders(scope, folderData.folders);
      await writeLocalFolders(scope, mergedFolders);
    } catch {
      /* keep local snapshot */
    }

    try {
      const projectData = await habitat().call("project.list", { ...subjectPayload() });
      const mergedProjects = await mergeServerProjects(scope, projectData.projects);
      await writeLocalProjects(scope, mergedProjects);
      for (const project of mergedProjects) {
        if (!cachedProjectIds.includes(project.id)) cachedProjectIds.push(project.id);
      }
    } catch {
      /* keep local snapshot */
    }

    for (const projectId of new Set(cachedProjectIds)) {
      if (isTempId(projectId)) continue;
      try {
        const itemData = await habitat().call("project.item.list", {
          ...subjectPayload(),
          project_id: projectId,
        });
        const merged = await mergeServerItems(scope, projectId, itemData.items);
        await writeLocalItems(scope, projectId, merged);
      } catch {
        /* keep local snapshot */
      }
    }
  },
};

export function registerProjectOfflineModule(): void {
  registerOfflineModule(projectRpcAdapter);
  registerOfflineModuleCap(MODULE_ID, { offlineWritable: true });
  void ensureAllocatorSeeded(resolveOutboxScope()).catch(() => {});
}

export async function offlineCreateProjectFolder(input: {
  name: string;
  parent_id?: number | null;
  sort_order?: number;
}): Promise<ProjectFolderRow> {
  const name = input.name.trim();
  if (name.length === 0) throw new Error("project folder name is required");

  const doOffline = async (): Promise<ProjectFolderRow> => {
    const scope = resolveOutboxScope();
    await ensureAllocatorSeeded(scope);
    const tempId = allocateTempId(scope, MODULE_ID);
    const opId = randomUuid();
    const now = new Date().toISOString();
    const row: ProjectFolderRow = {
      id: tempId,
      name,
      parent_id: input.parent_id ?? null,
      sort_order: input.sort_order ?? 0,
      created_at: now,
      updated_at: now,
    };
    await upsertLocalFolder(scope, row);

    const baseOp = {
      id: opId,
      moduleId: MODULE_ID,
      method: "projectfolder.create",
      payload: omitUndefined({
        ...subjectPayload(),
        client_op_id: opId,
        name: row.name,
        parent_id: row.parent_id,
        sort_order: row.sort_order,
      }),
      tempEntityId: tempId,
      createdAt: now,
    } satisfies OfflineOutboxOp;

    if (input.parent_id != null && isTempId(input.parent_id)) {
      await enqueueOutboxOp(scope, {
        ...baseOp,
        dependsOn: [{ tempId: input.parent_id, field: "parent_id" }],
      });
    } else {
      await enqueueOutboxOp(scope, baseOp);
    }
    scheduleFlush(scope);
    return row;
  };

  if (input.parent_id != null && (await unresolvedTempId(resolveOutboxScope(), input.parent_id))) {
    return doOffline();
  }

  return preferOnlineWrite(async () => {
    const scope = resolveOutboxScope();
    const opId = randomUuid();
    const data = await habitat().call(
      "projectfolder.create",
      omitUndefined({
        ...subjectPayload(),
        client_op_id: opId,
        name,
        parent_id: input.parent_id ?? null,
        sort_order: input.sort_order,
      }),
    );
    await upsertLocalFolder(scope, data.item);
    return data.item;
  }, doOffline);
}

export async function offlineUpdateProjectFolder(
  id: number,
  patch: Partial<Pick<ProjectFolderRow, "name" | "parent_id" | "sort_order">>,
): Promise<ProjectFolderRow> {
  const scope = resolveOutboxScope();
  const folders = await readLocalFolders(scope);
  const resolvedId = await resolveEntityId(scope, id);
  const existing =
    folders.find((row) => row.id === resolvedId) ??
    (resolvedId !== id ? folders.find((row) => row.id === id) : undefined);
  if (!existing) throw new Error("project folder not found locally");

  const doOffline = async (): Promise<ProjectFolderRow> => {
    const now = new Date().toISOString();
    const updated: ProjectFolderRow = { ...existing, ...patch, updated_at: now };
    await upsertLocalFolder(scope, updated);

    const opId = randomUuid();
    await enqueueOutboxOp(scope, {
      id: opId,
      moduleId: MODULE_ID,
      method: "projectfolder.patch",
      payload: omitUndefined({
        ...subjectPayload(),
        id: existing.id,
        client_op_id: opId,
        ...patch,
      }),
      createdAt: now,
    });
    scheduleFlush(scope);
    return updated;
  };

  if (
    (await unresolvedTempId(scope, existing.id)) ||
    (patch.parent_id != null && (await unresolvedTempId(scope, patch.parent_id)))
  ) {
    return doOffline();
  }

  return preferOnlineWrite(async () => {
    const opId = randomUuid();
    const data = await habitat().call(
      "projectfolder.patch",
      omitUndefined({
        ...subjectPayload(),
        id: existing.id,
        client_op_id: opId,
        ...patch,
      }),
    );
    await upsertLocalFolder(scope, data.item);
    return data.item;
  }, doOffline);
}

export async function offlineDeleteProjectFolder(id: number): Promise<void> {
  const scope = resolveOutboxScope();
  const resolvedId = await resolveEntityId(scope, id);

  const doOffline = async (): Promise<void> => {
    await removeLocalFolder(scope, resolvedId);
    if (resolvedId !== id) await removeLocalFolder(scope, id);

    if (isTempId(resolvedId) || isTempId(id)) {
      const tempIds = new Set([id, resolvedId].filter(isTempId));
      const ops = await listOutboxOps(scope, MODULE_ID);
      for (const op of ops) {
        if (
          (typeof op.tempEntityId === "number" && tempIds.has(op.tempEntityId)) ||
          (typeof op.payload.id === "number" &&
            (tempIds.has(op.payload.id) || op.payload.id === resolvedId))
        ) {
          await removeOutboxOp(scope, op.id);
        }
      }
      return;
    }

    const opId = randomUuid();
    await enqueueOutboxOp(scope, {
      id: opId,
      moduleId: MODULE_ID,
      method: "projectfolder.delete",
      payload: { ...subjectPayload(), id: resolvedId, client_op_id: opId },
      createdAt: new Date().toISOString(),
    });
    scheduleFlush(scope);
  };

  if (await unresolvedTempId(scope, resolvedId)) {
    return doOffline();
  }

  return preferOnlineWrite(async () => {
    const opId = randomUuid();
    await habitat().call("projectfolder.delete", {
      ...subjectPayload(),
      id: resolvedId,
      client_op_id: opId,
    });
    await removeLocalFolder(scope, resolvedId);
    if (resolvedId !== id) await removeLocalFolder(scope, id);
  }, doOffline);
}

export async function offlineCreateProject(input: {
  title: string;
  start_at?: string | null;
  end_at?: string | null;
  content?: string;
  folder_id?: number | null;
}): Promise<ProjectRow> {
  const title = input.title.trim();
  if (title.length === 0) throw new Error("project title is required");

  const doOffline = async (): Promise<ProjectRow> => {
    const scope = resolveOutboxScope();
    await ensureAllocatorSeeded(scope);
    const tempId = allocateTempId(scope, MODULE_ID);
    const opId = randomUuid();
    const now = new Date().toISOString();
    const content = input.content?.trim() ?? "";
    const row: ProjectRow = {
      id: tempId,
      title,
      content,
      folder_id: input.folder_id ?? null,
      start_at: input.start_at ?? null,
      end_at: input.end_at ?? null,
      status: "active",
      product_tag: null,
      sort_order: 0,
      task_count: 0,
      linked_diary_ids: [],
      created_at: now,
      updated_at: now,
    };
    await upsertLocalProject(scope, row);

    const baseOp = {
      id: opId,
      moduleId: MODULE_ID,
      method: "project.create",
      payload: omitUndefined({
        ...subjectPayload(),
        client_op_id: opId,
        title: row.title,
        start_at: row.start_at,
        end_at: row.end_at,
        content: row.content || undefined,
        folder_id: row.folder_id,
      }),
      tempEntityId: tempId,
      createdAt: now,
    } satisfies OfflineOutboxOp;

    if (input.folder_id != null && isTempId(input.folder_id)) {
      await enqueueOutboxOp(scope, {
        ...baseOp,
        dependsOn: [{ tempId: input.folder_id, field: "folder_id" }],
      });
    } else {
      await enqueueOutboxOp(scope, baseOp);
    }
    scheduleFlush(scope);
    return row;
  };

  if (input.folder_id != null && (await unresolvedTempId(resolveOutboxScope(), input.folder_id))) {
    return doOffline();
  }

  return preferOnlineWrite(async () => {
    const scope = resolveOutboxScope();
    const opId = randomUuid();
    const content = input.content?.trim() ?? "";
    const data = await habitat().call(
      "project.create",
      omitUndefined({
        ...subjectPayload(),
        client_op_id: opId,
        title,
        start_at: input.start_at ?? null,
        end_at: input.end_at ?? null,
        content: content || undefined,
        folder_id: input.folder_id ?? null,
      }),
    );
    await upsertLocalProject(scope, data.item);
    return data.item;
  }, doOffline);
}

export async function offlineUpdateProject(
  id: number,
  patch: {
    status?: ProjectRow["status"];
    linked_diary_ids?: number[];
    title?: string;
    start_at?: string | null;
    end_at?: string | null;
    content?: string;
    folder_id?: number | null;
    sort_order?: number;
  },
): Promise<ProjectRow> {
  const scope = resolveOutboxScope();
  const projects = await readLocalProjects(scope);
  const resolvedId = await resolveEntityId(scope, id);
  const existing =
    projects.find((row) => row.id === resolvedId) ??
    (resolvedId !== id ? projects.find((row) => row.id === id) : undefined);
  if (!existing) throw new Error("project not found locally");

  const doOffline = async (): Promise<ProjectRow> => {
    const now = new Date().toISOString();
    const updated: ProjectRow = {
      ...existing,
      ...patch,
      updated_at: now,
    };
    await upsertLocalProject(scope, updated);

    const opId = randomUuid();
    await enqueueOutboxOp(scope, {
      id: opId,
      moduleId: MODULE_ID,
      method: "project.patch",
      payload: omitUndefined({
        ...subjectPayload(),
        id: existing.id,
        client_op_id: opId,
        ...patch,
      }),
      createdAt: now,
    });
    scheduleFlush(scope);
    return updated;
  };

  if (
    (await unresolvedTempId(scope, existing.id)) ||
    (patch.folder_id != null && (await unresolvedTempId(scope, patch.folder_id)))
  ) {
    return doOffline();
  }

  return preferOnlineWrite(async () => {
    const opId = randomUuid();
    const data = await habitat().call(
      "project.patch",
      omitUndefined({
        ...subjectPayload(),
        id: existing.id,
        client_op_id: opId,
        ...patch,
      }),
    );
    await upsertLocalProject(scope, data.item);
    return data.item;
  }, doOffline);
}

export async function offlineDeleteProject(id: number): Promise<void> {
  const scope = resolveOutboxScope();
  const resolvedId = await resolveEntityId(scope, id);

  const doOffline = async (): Promise<void> => {
    await removeLocalProject(scope, resolvedId);
    if (resolvedId !== id) await removeLocalProject(scope, id);

    if (isTempId(resolvedId) || isTempId(id)) {
      const tempIds = new Set([id, resolvedId].filter(isTempId));
      const ops = await listOutboxOps(scope, MODULE_ID);
      for (const op of ops) {
        if (
          (typeof op.tempEntityId === "number" && tempIds.has(op.tempEntityId)) ||
          (typeof op.payload.id === "number" &&
            (tempIds.has(op.payload.id) || op.payload.id === resolvedId)) ||
          (typeof op.payload.project_id === "number" && tempIds.has(op.payload.project_id))
        ) {
          await removeOutboxOp(scope, op.id);
        }
      }
      return;
    }

    const opId = randomUuid();
    await enqueueOutboxOp(scope, {
      id: opId,
      moduleId: MODULE_ID,
      method: "project.delete",
      payload: { ...subjectPayload(), id: resolvedId, client_op_id: opId },
      createdAt: new Date().toISOString(),
    });
    scheduleFlush(scope);
  };

  if (await unresolvedTempId(scope, resolvedId)) {
    return doOffline();
  }

  return preferOnlineWrite(async () => {
    const opId = randomUuid();
    await habitat().call("project.delete", {
      ...subjectPayload(),
      id: resolvedId,
      client_op_id: opId,
    });
    await removeLocalProject(scope, resolvedId);
    if (resolvedId !== id) await removeLocalProject(scope, id);
  }, doOffline);
}

export async function offlineCreateProjectTask(input: {
  title: string;
  project_id: number;
  sort_order?: number;
}): Promise<TaskItemRow> {
  const title = input.title.trim();
  if (title.length === 0) throw new Error("task title is required");

  const doOffline = async (): Promise<TaskItemRow> => {
    const scope = resolveOutboxScope();
    await ensureAllocatorSeeded(scope);
    const tempId = allocateTempId(scope, MODULE_ID);
    const opId = randomUuid();
    const now = new Date().toISOString();
    const row: TaskItemRow = {
      id: tempId,
      title,
      content: "",
      tag_ids: [],
      status: "pending",
      priority: "none",
      due_at: null,
      remind_at: null,
      list_id: null,
      project_id: input.project_id,
      sort_order: input.sort_order ?? 0,
      completed_at: null,
      created_at: now,
      updated_at: now,
    };
    await upsertLocalItem(scope, row);
    await adjustProjectTaskCount(scope, input.project_id, 1);

    const baseOp = {
      id: opId,
      moduleId: MODULE_ID,
      method: "project.item.create",
      payload: {
        ...subjectPayload(),
        client_op_id: opId,
        title: row.title,
        project_id: row.project_id,
        sort_order: row.sort_order,
      },
      tempEntityId: tempId,
      createdAt: now,
    } satisfies OfflineOutboxOp;

    if (isTempId(input.project_id)) {
      await enqueueOutboxOp(scope, {
        ...baseOp,
        dependsOn: [{ tempId: input.project_id, field: "project_id" }],
      });
    } else {
      await enqueueOutboxOp(scope, baseOp);
    }
    scheduleFlush(scope);
    return row;
  };

  if (await unresolvedTempId(resolveOutboxScope(), input.project_id)) {
    return doOffline();
  }

  return preferOnlineWrite(async () => {
    const scope = resolveOutboxScope();
    const opId = randomUuid();
    const data = await habitat().call("project.item.create", {
      ...subjectPayload(),
      client_op_id: opId,
      title,
      project_id: input.project_id,
      sort_order: input.sort_order ?? 0,
    });
    await upsertLocalItem(scope, data.item);
    await adjustProjectTaskCount(scope, input.project_id, 1);
    return data.item;
  }, doOffline);
}

export async function offlineUpdateProjectTask(
  id: number,
  patch: Partial<
    Pick<
      TaskItemRow,
      "title" | "content" | "tag_ids" | "priority" | "due_at" | "sort_order" | "status"
    >
  >,
): Promise<TaskItemRow> {
  const scope = resolveOutboxScope();
  const found = await findLocalItem(scope, id);
  if (!found) throw new Error("task item not found locally");
  const existing = found.item;

  const doOffline = async (): Promise<TaskItemRow> => {
    const now = new Date().toISOString();
    const nextStatus = patch.status ?? existing.status;
    const updated: TaskItemRow = {
      ...existing,
      ...patch,
      status: nextStatus,
      completed_at:
        patch.status === "completed"
          ? formatCstIso(new Date())
          : patch.status === "pending"
            ? null
            : existing.completed_at,
      updated_at: now,
    };
    await upsertLocalItem(scope, updated);

    const method =
      patch.status === "completed"
        ? "task.complete"
        : patch.status === "pending" && existing.status === "completed"
          ? "task.uncomplete"
          : "task.patch";

    const opId = randomUuid();
    if (method === "task.complete" || method === "task.uncomplete") {
      await enqueueOutboxOp(scope, {
        id: opId,
        moduleId: MODULE_ID,
        method,
        payload: { ...subjectPayload(), id: existing.id, client_op_id: opId },
        createdAt: now,
      });
    } else {
      const { status: _status, ...contentPatch } = patch;
      await enqueueOutboxOp(scope, {
        id: opId,
        moduleId: MODULE_ID,
        method: "task.patch",
        payload: omitUndefined({
          ...subjectPayload(),
          id: existing.id,
          client_op_id: opId,
          ...contentPatch,
        }),
        createdAt: now,
      });
    }
    scheduleFlush(scope);
    return updated;
  };

  if (await unresolvedTempId(scope, existing.id)) {
    return doOffline();
  }

  return preferOnlineWrite(async () => {
    const opId = randomUuid();
    const method =
      patch.status === "completed"
        ? "task.complete"
        : patch.status === "pending" && existing.status === "completed"
          ? "task.uncomplete"
          : "task.patch";

    if (method === "task.complete" || method === "task.uncomplete") {
      const data = await habitat().call(method, {
        ...subjectPayload(),
        id: existing.id,
        client_op_id: opId,
      });
      await upsertLocalItem(scope, data.item);
      return data.item;
    }

    const { status: _status, ...contentPatch } = patch;
    const data = await habitat().call(
      "task.patch",
      omitUndefined({
        ...subjectPayload(),
        id: existing.id,
        client_op_id: opId,
        ...contentPatch,
      }),
    );
    await upsertLocalItem(scope, data.item);
    return data.item;
  }, doOffline);
}

export async function offlineDeleteProjectTask(id: number): Promise<void> {
  const scope = resolveOutboxScope();
  const found = await findLocalItem(scope, id);
  const resolvedId = found?.item.id ?? (await resolveEntityId(scope, id));
  const projectId = found?.projectId;

  const doOffline = async (): Promise<void> => {
    if (projectId != null) {
      await removeLocalItem(scope, projectId, resolvedId);
      if (resolvedId !== id) await removeLocalItem(scope, projectId, id);
      if (found?.item.status === "pending") {
        await adjustProjectTaskCount(scope, projectId, -1);
      }
    }

    if (isTempId(resolvedId) || isTempId(id)) {
      const tempIds = new Set([id, resolvedId].filter(isTempId));
      const ops = await listOutboxOps(scope, MODULE_ID);
      for (const op of ops) {
        if (
          (typeof op.tempEntityId === "number" && tempIds.has(op.tempEntityId)) ||
          (typeof op.payload.id === "number" &&
            (tempIds.has(op.payload.id) || op.payload.id === resolvedId))
        ) {
          await removeOutboxOp(scope, op.id);
        }
      }
      return;
    }

    const opId = randomUuid();
    await enqueueOutboxOp(scope, {
      id: opId,
      moduleId: MODULE_ID,
      method: "task.delete",
      payload: { ...subjectPayload(), id: resolvedId, client_op_id: opId },
      createdAt: new Date().toISOString(),
    });
    scheduleFlush(scope);
  };

  if (await unresolvedTempId(scope, resolvedId)) {
    return doOffline();
  }

  return preferOnlineWrite(async () => {
    const opId = randomUuid();
    await habitat().call("task.delete", {
      ...subjectPayload(),
      id: resolvedId,
      client_op_id: opId,
    });
    if (projectId != null) {
      await removeLocalItem(scope, projectId, resolvedId);
      if (resolvedId !== id) await removeLocalItem(scope, projectId, id);
      if (found?.item.status === "pending") {
        await adjustProjectTaskCount(scope, projectId, -1);
      }
    }
  }, doOffline);
}

export async function offlineMoveProjectTaskToList(taskId: number, listId: number): Promise<void> {
  const scope = resolveOutboxScope();
  const found = await findLocalItem(scope, taskId);
  if (!found) throw new Error("task item not found locally");
  const resolvedId = found.item.id;

  const doOffline = async (): Promise<void> => {
    await removeLocalItem(scope, found.projectId, resolvedId);
    if (found.item.status === "pending") {
      await adjustProjectTaskCount(scope, found.projectId, -1);
    }

    const opId = randomUuid();
    await enqueueOutboxOp(scope, {
      id: opId,
      moduleId: MODULE_ID,
      method: "task.moveToList",
      payload: {
        ...subjectPayload(),
        id: resolvedId,
        list_id: listId,
        client_op_id: opId,
      },
      createdAt: new Date().toISOString(),
    });
    scheduleFlush(scope);
  };

  if ((await unresolvedTempId(scope, resolvedId)) || (await unresolvedTempId(scope, listId))) {
    return doOffline();
  }

  return preferOnlineWrite(async () => {
    const opId = randomUuid();
    await habitat().call("task.moveToList", {
      ...subjectPayload(),
      id: resolvedId,
      list_id: listId,
      client_op_id: opId,
    });
    await removeLocalItem(scope, found.projectId, resolvedId);
    if (found.item.status === "pending") {
      await adjustProjectTaskCount(scope, found.projectId, -1);
    }
  }, doOffline);
}

export async function offlineMoveTaskToProject(
  taskId: number,
  projectId: number,
): Promise<TaskItemRow> {
  const scope = resolveOutboxScope();
  const found = await findLocalItem(scope, taskId);

  const doOffline = async (): Promise<TaskItemRow> => {
    const now = new Date().toISOString();

    let row: TaskItemRow;
    if (found) {
      if (found.projectId !== projectId) {
        await removeLocalItem(scope, found.projectId, found.item.id);
        if (found.item.status === "pending") {
          await adjustProjectTaskCount(scope, found.projectId, -1);
        }
      }
      row = {
        ...found.item,
        list_id: null,
        project_id: projectId,
        updated_at: now,
      };
    } else {
      row = {
        id: taskId,
        title: "",
        content: "",
        tag_ids: [],
        status: "pending",
        priority: "none",
        due_at: null,
        remind_at: null,
        list_id: null,
        project_id: projectId,
        sort_order: 0,
        completed_at: null,
        created_at: now,
        updated_at: now,
      };
    }
    await upsertLocalItem(scope, row);
    if (!found || found.projectId !== projectId) {
      await adjustProjectTaskCount(scope, projectId, 1);
    }

    const opId = randomUuid();
    const baseOp = {
      id: opId,
      moduleId: MODULE_ID,
      method: "task.moveToProject",
      payload: {
        ...subjectPayload(),
        id: row.id,
        project_id: projectId,
        client_op_id: opId,
      },
      createdAt: now,
    } satisfies OfflineOutboxOp;

    if (isTempId(projectId)) {
      await enqueueOutboxOp(scope, {
        ...baseOp,
        dependsOn: [{ tempId: projectId, field: "project_id" }],
      });
    } else {
      await enqueueOutboxOp(scope, baseOp);
    }
    scheduleFlush(scope);
    return row;
  };

  const resolvedTaskId = found?.item.id ?? (await resolveEntityId(scope, taskId));
  if (
    (await unresolvedTempId(scope, resolvedTaskId)) ||
    (await unresolvedTempId(scope, projectId))
  ) {
    return doOffline();
  }

  return preferOnlineWrite(async () => {
    const opId = randomUuid();
    const data = await habitat().call("task.moveToProject", {
      ...subjectPayload(),
      id: resolvedTaskId,
      project_id: projectId,
      client_op_id: opId,
    });
    if (found && found.projectId !== projectId) {
      await removeLocalItem(scope, found.projectId, found.item.id);
      if (found.item.status === "pending") {
        await adjustProjectTaskCount(scope, found.projectId, -1);
      }
    }
    await upsertLocalItem(scope, data.item);
    if (!found || found.projectId !== projectId) {
      await adjustProjectTaskCount(scope, projectId, 1);
    }
    return data.item;
  }, doOffline);
}

export async function countProjectPendingOps(): Promise<number> {
  return listOutboxOps(resolveOutboxScope(), MODULE_ID).then((ops) => ops.length);
}
