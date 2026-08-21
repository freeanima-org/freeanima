import type { NotificationRecipientKind } from "@freeanima/shared/rpc-contract/frames/notification";

export type SubjectKind = NotificationRecipientKind;
import type {
  ProjectFolderRowPayload,
  ProjectRowPayload,
} from "@freeanima/shared/rpc-contract/frames/project";
import { normalizeTaskItemRows } from "@freeanima/features/task/ui/spa/lib/normalize-task-item.ts";
import type { TaskItemRowPayload } from "@freeanima/shared/rpc-contract/frames/task";

import { resolveHabitatCacheScope } from "@freeanima/client/portal-sdk/offline-cache";
import { withOfflineCache } from "@freeanima/client/portal-sdk/offline-cache-first";
import { isHabitatFetchAvailable } from "@freeanima/client/portal-sdk/habitat-fetch-gate";
import { isTempId } from "@freeanima/client/portal-sdk/offline-temp-id";
import { getTypedHabitatClient } from "@freeanima/client/portal-sdk/habitat-typed-client.ts";

import {
  offlineCreateProject,
  offlineCreateProjectFolder,
  offlineCreateProjectTask,
  offlineDeleteProject,
  offlineDeleteProjectFolder,
  offlineDeleteProjectTask,
  offlineMoveProjectTaskToList,
  offlineMoveTaskToProject,
  offlineUpdateProject,
  offlineUpdateProjectFolder,
  offlineUpdateProjectTask,
  reconcileServerProjectFolders,
  reconcileServerProjectItems,
  reconcileServerProjects,
  registerProjectOfflineModule,
} from "./offline-store.ts";
import {
  readCachedProjectItems,
  readCachedProjects,
  writeCachedProjects,
} from "./offline-cache.ts";

export type ProjectFolderRow = ProjectFolderRowPayload;
export type ProjectRow = ProjectRowPayload;
export type TaskItemRow = TaskItemRowPayload;

export type TaskListRow = {
  id: number;
  name: string;
  sort_order: number;
  closed: boolean;
  color: string | null;
  is_default: boolean;
  is_folder: boolean;
  parent_id: number | null;
  item_count: number;
  created_at: string;
  updated_at: string;
};

export type ProjectPickerRow = { id: number; title: string; status: string };

let projectModuleRegistered = false;

function ensureProjectOfflineModule(): void {
  if (projectModuleRegistered) return;
  registerProjectOfflineModule();
  projectModuleRegistered = true;
}

function habitat() {
  return getTypedHabitatClient();
}

export async function fetchProjectFolders(subjectId: number): Promise<ProjectFolderRow[]> {
  const scope = resolveHabitatCacheScope();
  return withOfflineCache({
    scope,
    namespace: "project",
    id: "folders",
    fetch: async () => {
      const data = await habitat().call("projectfolder.list", { subject_id: subjectId });
      return data.folders;
    },
    reconcile: (folders) => reconcileServerProjectFolders(folders),
    offlineError: "projectfolder.list unavailable offline",
  });
}

function withDefaultProjectTaskCount(projects: ProjectRow[]): ProjectRow[] {
  return projects.map((p) => ({
    id: p.id,
    title: p.title,
    content: p.content,
    folder_id: p.folder_id,
    start_at: p.start_at,
    end_at: p.end_at,
    status: p.status,
    product_tag: p.product_tag,
    sort_order: p.sort_order,
    task_count: p.task_count ?? 0,
    linked_diary_ids: p.linked_diary_ids,
    created_at: p.created_at,
    updated_at: p.updated_at,
  }));
}

export async function fetchProjects(
  subjectId: number,
  folderId?: number | null,
): Promise<ProjectRow[]> {
  const scope = resolveHabitatCacheScope();
  if (folderId !== undefined) {
    if (folderId != null && isTempId(folderId)) {
      const cached = (await readCachedProjects(scope)) ?? [];
      return withDefaultProjectTaskCount(cached.filter((p) => (p.folder_id ?? null) === folderId));
    }

    const readLocalFiltered = async (): Promise<ProjectRow[]> => {
      const cached = (await readCachedProjects(scope)) ?? [];
      return withDefaultProjectTaskCount(cached.filter((p) => (p.folder_id ?? null) === folderId));
    };

    if (!isHabitatFetchAvailable()) {
      return readLocalFiltered();
    }

    try {
      const data = await habitat().call("project.list", {
        subject_id: subjectId,
        folder_id: folderId,
      });
      const projects = withDefaultProjectTaskCount(data.projects);
      const cached = (await readCachedProjects(scope)) ?? [];
      const byId = new Map(cached.map((p) => [p.id, p]));
      for (const p of projects) byId.set(p.id, p);
      void writeCachedProjects(scope, [...byId.values()]);
      return projects;
    } catch {
      return readLocalFiltered();
    }
  }
  return withOfflineCache({
    scope,
    namespace: "project",
    id: "projects",
    fetch: async () => {
      const data = await habitat().call("project.list", { subject_id: subjectId });
      return withDefaultProjectTaskCount(data.projects);
    },
    reconcile: (projects) => reconcileServerProjects(projects),
    offlineError: "project.list unavailable offline",
  });
}

export async function fetchProjectStats(subjectId: number): Promise<Map<number, number>> {
  if (!isHabitatFetchAvailable()) return new Map();
  const data = await habitat().call("project.stats", { subject_id: subjectId });
  return new Map(data.counts.map((row) => [row.id, row.task_count]));
}

export async function fetchProject(subjectId: number, id: number): Promise<ProjectRow> {
  const scope = resolveHabitatCacheScope();

  const readLocal = async (): Promise<ProjectRow> => {
    const cached = (await readCachedProjects(scope)) ?? [];
    const found = cached.find((p) => p.id === id);
    if (!found) throw new Error("project not found locally");
    return found;
  };

  if (isTempId(id)) {
    return readLocal();
  }

  if (!isHabitatFetchAvailable()) {
    return readLocal();
  }

  try {
    const data = await habitat().call("project.get", { subject_id: subjectId, id });
    const cached = (await readCachedProjects(scope)) ?? [];
    const next = cached.filter((p) => p.id !== data.item.id);
    next.push(data.item);
    void writeCachedProjects(scope, next);
    return data.item;
  } catch {
    return readLocal();
  }
}

export async function createProjectApi(
  _subjectId: number,
  input: {
    title: string;
    start_at?: string | null;
    end_at?: string | null;
    content?: string;
    folder_id?: number | null;
  },
): Promise<ProjectRow> {
  ensureProjectOfflineModule();
  return offlineCreateProject(input);
}

export async function fetchProjectTasks(
  subjectId: number,
  projectId: number,
): Promise<TaskItemRow[]> {
  const scope = resolveHabitatCacheScope();
  if (isTempId(projectId)) {
    return normalizeTaskItemRows(await readCachedProjectItems(scope, projectId));
  }
  return withOfflineCache({
    scope,
    namespace: "project",
    id: `items:${String(projectId)}`,
    fetch: async () => {
      const data = await habitat().call("project.item.list", {
        subject_id: subjectId,
        project_id: projectId,
      });
      return normalizeTaskItemRows(data.items);
    },
    reconcile: (items) => reconcileServerProjectItems(projectId, items),
    offlineError: "project.item.list unavailable offline",
  });
}

export async function createProjectTask(
  _subjectId: number,
  input: { title: string; project_id: number; sort_order?: number },
): Promise<TaskItemRow> {
  ensureProjectOfflineModule();
  return offlineCreateProjectTask(input);
}

export async function moveTaskToProject(
  _subjectId: number,
  taskId: number,
  projectId: number,
): Promise<TaskItemRow> {
  ensureProjectOfflineModule();
  return offlineMoveTaskToProject(taskId, projectId);
}

export async function patchProjectApi(
  _subjectId: number,
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
  ensureProjectOfflineModule();
  return offlineUpdateProject(id, patch);
}

export async function deleteProjectApi(_subjectId: number, id: number): Promise<void> {
  ensureProjectOfflineModule();
  return offlineDeleteProject(id);
}

export async function createProjectFolderApi(
  _subjectId: number,
  name: string,
  parentId?: number | null,
): Promise<ProjectFolderRow> {
  ensureProjectOfflineModule();
  return offlineCreateProjectFolder({ name, parent_id: parentId ?? null });
}

export async function patchProjectFolderApi(
  _subjectId: number,
  id: number,
  patch: { name?: string; parent_id?: number | null; sort_order?: number },
): Promise<ProjectFolderRow> {
  ensureProjectOfflineModule();
  return offlineUpdateProjectFolder(id, patch);
}

export async function deleteProjectFolderApi(_subjectId: number, id: number): Promise<void> {
  ensureProjectOfflineModule();
  return offlineDeleteProjectFolder(id);
}

export async function updateProjectTask(
  _subjectId: number,
  id: number,
  patch: Partial<
    Pick<
      TaskItemRow,
      | "title"
      | "content"
      | "tag_ids"
      | "priority"
      | "start_at"
      | "end_at"
      | "due_at"
      | "remind_at"
      | "reminders"
      | "sort_order"
      | "status"
      | "recurrence"
    >
  > & { only_this?: boolean },
): Promise<TaskItemRow> {
  ensureProjectOfflineModule();
  return offlineUpdateProjectTask(id, patch);
}

export async function completeProjectTask(_subjectId: number, id: number): Promise<TaskItemRow> {
  ensureProjectOfflineModule();
  return offlineUpdateProjectTask(id, { status: "completed" });
}

export async function uncompleteProjectTask(_subjectId: number, id: number): Promise<TaskItemRow> {
  ensureProjectOfflineModule();
  return offlineUpdateProjectTask(id, { status: "pending" });
}

export async function deleteProjectTask(_subjectId: number, id: number): Promise<void> {
  ensureProjectOfflineModule();
  return offlineDeleteProjectTask(id);
}

export async function fetchTaskListsForMove(subjectId: number): Promise<TaskListRow[]> {
  if (!isHabitatFetchAvailable()) return [];
  const data = await habitat().call("tasklist.list", { subject_id: subjectId });
  return data.lists.map((list) => ({
    id: list.id,
    name: list.name,
    sort_order: list.sort_order,
    closed: list.closed,
    color: list.color,
    is_default: list.is_default,
    is_folder: list.is_folder,
    parent_id: list.parent_id,
    item_count: list.item_count ?? 0,
    created_at: list.created_at,
    updated_at: list.updated_at,
  }));
}

export async function fetchProjectsForMove(subjectId: number): Promise<ProjectPickerRow[]> {
  const projects = await fetchProjects(subjectId);
  return projects.map((p) => ({ id: p.id, title: p.title, status: p.status }));
}

export async function moveProjectTaskToList(
  _subjectId: number,
  taskId: number,
  listId: number,
): Promise<void> {
  ensureProjectOfflineModule();
  return offlineMoveProjectTaskToList(taskId, listId);
}

export { countProjectPendingOps } from "./offline-store.ts";
