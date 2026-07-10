import type { NotificationRecipientKind } from "@freeanima/shared/sap-contract/frames/notification";

export type SubjectKind = NotificationRecipientKind;
import type {
  MilestoneRowPayload,
  ProjectFolderRowPayload,
  ProjectRowPayload,
} from "@freeanima/shared/sap-contract/frames/project";
import type { TaskItemRowPayload } from "@freeanima/shared/sap-contract/frames/task";

import { getSatelliteHubClient } from "@freeanima/shared/hub-client";

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

function hub() {
  return getSatelliteHubClient();
}

export async function fetchProjectFolders(subjectKind: SubjectKind): Promise<ProjectFolderRow[]> {
  const data = await hub().call("projectfolder.list", { subject_kind: subjectKind });
  return data.folders;
}

export async function fetchProjects(
  subjectKind: SubjectKind,
  folderId?: number | null,
): Promise<ProjectRow[]> {
  const data = await hub().call("project.list", {
    subject_kind: subjectKind,
    ...(folderId !== undefined ? { folder_id: folderId } : {}),
  });
  return data.projects;
}

export async function fetchProject(subjectKind: SubjectKind, id: number): Promise<ProjectRow> {
  const data = await hub().call("project.get", { subject_kind: subjectKind, id });
  return data.item;
}

export async function createProjectApi(
  subjectKind: SubjectKind,
  input: {
    title: string;
    start_at: string;
    end_at: string;
    completion_criteria: string;
    folder_id?: number | null;
  },
): Promise<ProjectRow> {
  const data = await hub().call("project.create", { subject_kind: subjectKind, ...input });
  return data.item;
}

export async function fetchMilestones(
  subjectKind: SubjectKind,
  projectId: number,
): Promise<MilestoneRow[]> {
  const data = await hub().call("milestone.list", {
    subject_kind: subjectKind,
    project_id: projectId,
  });
  return data.milestones;
}

export async function createMilestoneApi(
  subjectKind: SubjectKind,
  input: { project_id: number; title: string; due_at: string },
): Promise<MilestoneRow> {
  const data = await hub().call("milestone.create", { subject_kind: subjectKind, ...input });
  return data.item;
}

export async function fetchProjectTasks(
  subjectKind: SubjectKind,
  projectId: number,
): Promise<TaskItemRow[]> {
  const data = await hub().call("task.list", {
    subject_kind: subjectKind,
    project_id: projectId,
  });
  return data.items;
}

export async function createProjectTask(
  subjectKind: SubjectKind,
  input: { title: string; list_id: number; project_id: number },
): Promise<TaskItemRow> {
  const data = await hub().call("task.create", { subject_kind: subjectKind, ...input });
  return data.item;
}

export async function moveTaskToProject(
  subjectKind: SubjectKind,
  taskId: number,
  projectId: number | null,
): Promise<TaskItemRow> {
  const data = await hub().call("task.patch", {
    subject_kind: subjectKind,
    id: taskId,
    project_id: projectId,
  });
  return data.item;
}

export async function patchProjectApi(
  subjectKind: SubjectKind,
  id: number,
  patch: {
    status?: ProjectRow["status"];
    linked_diary_ids?: number[];
    title?: string;
    start_at?: string;
    end_at?: string;
    completion_criteria?: string;
  },
): Promise<ProjectRow> {
  const data = await hub().call("project.patch", { subject_kind: subjectKind, id, ...patch });
  return data.item;
}

export async function deleteProjectApi(subjectKind: SubjectKind, id: number): Promise<void> {
  await hub().call("project.delete", { subject_kind: subjectKind, id });
}

export async function patchMilestoneApi(
  subjectKind: SubjectKind,
  id: number,
  patch: { status?: MilestoneRow["status"]; title?: string; due_at?: string },
): Promise<MilestoneRow> {
  const data = await hub().call("milestone.patch", { subject_kind: subjectKind, id, ...patch });
  return data.item;
}

export async function moveTaskToBacklog(subjectKind: SubjectKind, taskId: number): Promise<void> {
  await hub().call("task.patch", {
    subject_kind: subjectKind,
    id: taskId,
    project_id: null,
    milestone_id: null,
  });
}

export async function createProjectFolderApi(
  subjectKind: SubjectKind,
  name: string,
  parentId?: number | null,
): Promise<ProjectFolderRow> {
  const data = await hub().call("projectfolder.create", {
    subject_kind: subjectKind,
    name,
    parent_id: parentId ?? null,
  });
  return data.item;
}

export async function patchProjectFolderApi(
  subjectKind: SubjectKind,
  id: number,
  patch: { name?: string; parent_id?: number | null },
): Promise<ProjectFolderRow> {
  const data = await hub().call("projectfolder.patch", { subject_kind: subjectKind, id, ...patch });
  return data.item;
}

export async function deleteProjectFolderApi(subjectKind: SubjectKind, id: number): Promise<void> {
  await hub().call("projectfolder.delete", { subject_kind: subjectKind, id });
}

export async function updateProjectTask(
  subjectKind: SubjectKind,
  id: number,
  patch: Partial<
    Pick<TaskItemRow, "title" | "content" | "tags" | "priority" | "due_at" | "milestone_id">
  >,
): Promise<TaskItemRow> {
  const data = await hub().call("task.patch", { subject_kind: subjectKind, id, ...patch });
  return data.item;
}

export async function completeProjectTask(
  subjectKind: SubjectKind,
  id: number,
): Promise<TaskItemRow> {
  const data = await hub().call("task.complete", { subject_kind: subjectKind, id });
  return data.item;
}

export async function uncompleteProjectTask(
  subjectKind: SubjectKind,
  id: number,
): Promise<TaskItemRow> {
  const data = await hub().call("task.uncomplete", { subject_kind: subjectKind, id });
  return data.item;
}

export async function deleteProjectTask(subjectKind: SubjectKind, id: number): Promise<void> {
  await hub().call("task.delete", { subject_kind: subjectKind, id });
}

export async function fetchDefaultTaskListId(subjectKind: SubjectKind): Promise<number> {
  const data = await hub().call("tasklist.list", { subject_kind: subjectKind });
  const defaultList = data.lists.find((l) => l.is_default && !l.is_folder);
  if (defaultList) return defaultList.id;
  const first = data.lists.find((l) => !l.is_folder && !l.closed);
  if (!first) throw new Error("no task list available");
  return first.id;
}

export async function fetchTaskListsForMove(subjectKind: SubjectKind): Promise<TaskListRow[]> {
  const data = await hub().call("tasklist.list", { subject_kind: subjectKind });
  return data.lists;
}

export async function fetchProjectsForMove(subjectKind: SubjectKind): Promise<ProjectPickerRow[]> {
  const data = await hub().call("project.list", { subject_kind: subjectKind });
  return data.projects.map((p) => ({ id: p.id, title: p.title, status: p.status }));
}

export async function moveProjectTaskToList(
  subjectKind: SubjectKind,
  taskId: number,
  listId: number,
): Promise<void> {
  await hub().call("task.patch", {
    subject_kind: subjectKind,
    id: taskId,
    list_id: listId,
    project_id: null,
    milestone_id: null,
  });
}
