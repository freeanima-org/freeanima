import type { NotificationRecipientKind } from "@freeanima/shared/sap-contract/frames/notification";

export type SubjectKind = NotificationRecipientKind;
import type {
  MilestoneRowPayload,
  ProjectFolderRowPayload,
  ProjectRowPayload,
} from "@freeanima/shared/sap-contract/frames/project";
import type { TaskItemRowPayload } from "@freeanima/shared/sap-contract/frames/task";

import { resolveHubCacheScope } from "@freeanima/frontend/shell-sdk/offline-cache";
import { withOfflineCache } from "@freeanima/frontend/shell-sdk/offline-cache-first";
import { isHubFetchAvailable } from "@freeanima/frontend/shell-sdk/hub-fetch-gate";
import { isTempId } from "@freeanima/frontend/shell-sdk/offline-temp-id";
import { getTypedSatelliteHubClient } from "@freeanima/platform/hub/client.ts";

import {
  offlineCreateMilestone,
  offlineCreateProject,
  offlineCreateProjectFolder,
  offlineCreateProjectTask,
  offlineDeleteProject,
  offlineDeleteProjectFolder,
  offlineDeleteProjectTask,
  offlineMoveProjectTaskToList,
  offlineMoveTaskToProject,
  offlineUpdateMilestone,
  offlineUpdateProject,
  offlineUpdateProjectFolder,
  offlineUpdateProjectTask,
  reconcileServerMilestones,
  reconcileServerProjectFolders,
  reconcileServerProjectItems,
  reconcileServerProjects,
  registerProjectOfflineModule,
} from "./offline-store.ts";
import {
  readCachedMilestones,
  readCachedProjectItems,
  readCachedProjects,
} from "./offline-cache.ts";

export type ProjectFolderRow = ProjectFolderRowPayload;
export type ProjectRow = ProjectRowPayload;
export type MilestoneRow = MilestoneRowPayload;
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

function hub() {
  return getTypedSatelliteHubClient();
}

export async function fetchProjectFolders(subjectKind: SubjectKind): Promise<ProjectFolderRow[]> {
  const scope = resolveHubCacheScope();
  return withOfflineCache({
    scope,
    namespace: "project",
    id: "folders",
    fetch: async () => {
      const data = await hub().call("projectfolder.list", { subject_kind: subjectKind });
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
    completion_criteria: p.completion_criteria,
    status: p.status,
    product_tag: p.product_tag,
    sort_order: p.sort_order,
    task_count: p.task_count ?? 0,
    milestone_count: p.milestone_count,
    linked_diary_ids: p.linked_diary_ids,
    created_at: p.created_at,
    updated_at: p.updated_at,
  }));
}

export async function fetchProjects(
  subjectKind: SubjectKind,
  folderId?: number | null,
): Promise<ProjectRow[]> {
  const scope = resolveHubCacheScope();
  if (folderId !== undefined) {
    if (!isHubFetchAvailable()) {
      const cached = (await readCachedProjects(scope)) ?? [];
      return withDefaultProjectTaskCount(cached.filter((p) => (p.folder_id ?? null) === folderId));
    }
    const data = await hub().call("project.list", {
      subject_kind: subjectKind,
      folder_id: folderId,
    });
    return withDefaultProjectTaskCount(data.projects);
  }
  return withOfflineCache({
    scope,
    namespace: "project",
    id: "projects",
    fetch: async () => {
      const data = await hub().call("project.list", { subject_kind: subjectKind });
      return withDefaultProjectTaskCount(data.projects);
    },
    reconcile: (projects) => reconcileServerProjects(projects),
    offlineError: "project.list unavailable offline",
  });
}

export async function fetchProjectStats(subjectKind: SubjectKind): Promise<Map<number, number>> {
  if (!isHubFetchAvailable()) return new Map();
  const data = await hub().call("project.stats", { subject_kind: subjectKind });
  return new Map(data.counts.map((row) => [row.id, row.task_count]));
}

export async function fetchProject(subjectKind: SubjectKind, id: number): Promise<ProjectRow> {
  if (isTempId(id) || !isHubFetchAvailable()) {
    const cached = (await readCachedProjects(resolveHubCacheScope())) ?? [];
    const found = cached.find((p) => p.id === id);
    if (!found) throw new Error("project not found locally");
    return found;
  }
  const data = await hub().call("project.get", { subject_kind: subjectKind, id });
  return data.item;
}

export async function createProjectApi(
  _subjectKind: SubjectKind,
  input: {
    title: string;
    start_at: string;
    end_at: string;
    completion_criteria: string;
    folder_id?: number | null;
  },
): Promise<ProjectRow> {
  ensureProjectOfflineModule();
  return offlineCreateProject(input);
}

export async function fetchMilestones(
  subjectKind: SubjectKind,
  projectId: number,
): Promise<MilestoneRow[]> {
  const scope = resolveHubCacheScope();
  if (isTempId(projectId) || !isHubFetchAvailable()) {
    return (await readCachedMilestones(scope, projectId)) ?? [];
  }
  return withOfflineCache({
    scope,
    namespace: "project",
    id: `milestones:${projectId}`,
    fetch: async () => {
      const data = await hub().call("milestone.list", {
        subject_kind: subjectKind,
        project_id: projectId,
      });
      return data.milestones;
    },
    reconcile: (milestones) => reconcileServerMilestones(projectId, milestones),
    offlineError: "milestone.list unavailable offline",
  });
}

export async function createMilestoneApi(
  _subjectKind: SubjectKind,
  input: { project_id: number; title: string; due_at: string },
): Promise<MilestoneRow> {
  ensureProjectOfflineModule();
  return offlineCreateMilestone(input);
}

export async function fetchProjectTasks(
  subjectKind: SubjectKind,
  projectId: number,
): Promise<TaskItemRow[]> {
  const scope = resolveHubCacheScope();
  if (isTempId(projectId) || !isHubFetchAvailable()) {
    return (await readCachedProjectItems(scope, projectId)) ?? [];
  }
  return withOfflineCache({
    scope,
    namespace: "project",
    id: `items:${projectId}`,
    fetch: async () => {
      const data = await hub().call("project.item.list", {
        subject_kind: subjectKind,
        project_id: projectId,
      });
      return data.items;
    },
    reconcile: (items) => reconcileServerProjectItems(projectId, items),
    offlineError: "project.item.list unavailable offline",
  });
}

export async function createProjectTask(
  _subjectKind: SubjectKind,
  input: { title: string; project_id: number; sort_order?: number },
): Promise<TaskItemRow> {
  ensureProjectOfflineModule();
  return offlineCreateProjectTask(input);
}

export async function moveTaskToProject(
  _subjectKind: SubjectKind,
  taskId: number,
  projectId: number,
): Promise<TaskItemRow> {
  ensureProjectOfflineModule();
  return offlineMoveTaskToProject(taskId, projectId);
}

export async function patchProjectApi(
  _subjectKind: SubjectKind,
  id: number,
  patch: {
    status?: ProjectRow["status"];
    linked_diary_ids?: number[];
    title?: string;
    start_at?: string;
    end_at?: string;
    completion_criteria?: string;
    folder_id?: number | null;
    sort_order?: number;
  },
): Promise<ProjectRow> {
  ensureProjectOfflineModule();
  return offlineUpdateProject(id, patch);
}

export async function deleteProjectApi(_subjectKind: SubjectKind, id: number): Promise<void> {
  ensureProjectOfflineModule();
  return offlineDeleteProject(id);
}

export async function patchMilestoneApi(
  _subjectKind: SubjectKind,
  id: number,
  patch: { status?: MilestoneRow["status"]; title?: string; due_at?: string },
): Promise<MilestoneRow> {
  ensureProjectOfflineModule();
  return offlineUpdateMilestone(id, patch);
}

export async function createProjectFolderApi(
  _subjectKind: SubjectKind,
  name: string,
  parentId?: number | null,
): Promise<ProjectFolderRow> {
  ensureProjectOfflineModule();
  return offlineCreateProjectFolder({ name, parent_id: parentId ?? null });
}

export async function patchProjectFolderApi(
  _subjectKind: SubjectKind,
  id: number,
  patch: { name?: string; parent_id?: number | null; sort_order?: number },
): Promise<ProjectFolderRow> {
  ensureProjectOfflineModule();
  return offlineUpdateProjectFolder(id, patch);
}

export async function deleteProjectFolderApi(_subjectKind: SubjectKind, id: number): Promise<void> {
  ensureProjectOfflineModule();
  return offlineDeleteProjectFolder(id);
}

export async function updateProjectTask(
  _subjectKind: SubjectKind,
  id: number,
  patch: Partial<
    Pick<
      TaskItemRow,
      "title" | "content" | "tags" | "priority" | "due_at" | "milestone_id" | "sort_order"
    >
  >,
): Promise<TaskItemRow> {
  ensureProjectOfflineModule();
  return offlineUpdateProjectTask(id, patch);
}

export async function completeProjectTask(
  _subjectKind: SubjectKind,
  id: number,
): Promise<TaskItemRow> {
  ensureProjectOfflineModule();
  return offlineUpdateProjectTask(id, { status: "completed" });
}

export async function uncompleteProjectTask(
  _subjectKind: SubjectKind,
  id: number,
): Promise<TaskItemRow> {
  ensureProjectOfflineModule();
  return offlineUpdateProjectTask(id, { status: "pending" });
}

export async function deleteProjectTask(_subjectKind: SubjectKind, id: number): Promise<void> {
  ensureProjectOfflineModule();
  return offlineDeleteProjectTask(id);
}

export async function fetchTaskListsForMove(subjectKind: SubjectKind): Promise<TaskListRow[]> {
  if (!isHubFetchAvailable()) return [];
  const data = await hub().call("tasklist.list", { subject_kind: subjectKind });
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

export async function fetchProjectsForMove(subjectKind: SubjectKind): Promise<ProjectPickerRow[]> {
  const projects = await fetchProjects(subjectKind);
  return projects.map((p) => ({ id: p.id, title: p.title, status: p.status }));
}

export async function moveProjectTaskToList(
  _subjectKind: SubjectKind,
  taskId: number,
  listId: number,
): Promise<void> {
  ensureProjectOfflineModule();
  return offlineMoveProjectTaskToList(taskId, listId);
}

export { countProjectPendingOps } from "./offline-store.ts";
