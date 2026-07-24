import { readOfflineCache, writeOfflineCache } from "@freeanima/frontend/portal-sdk/offline-cache";

import type { ProjectFolderRow, ProjectRow, TaskItemRow } from "./api.ts";

export { resolveHabitatCacheScope } from "@freeanima/frontend/portal-sdk/offline-cache";

const NAMESPACE = "project";

export async function readCachedProjectFolders(scope: string): Promise<ProjectFolderRow[] | null> {
  const raw = await readOfflineCache<ProjectFolderRow[]>(scope, NAMESPACE, "folders");
  return Array.isArray(raw) ? raw : null;
}

export async function writeCachedProjectFolders(
  scope: string,
  folders: ProjectFolderRow[],
): Promise<void> {
  await writeOfflineCache(scope, NAMESPACE, "folders", folders);
}

export async function readCachedProjects(scope: string): Promise<ProjectRow[] | null> {
  const raw = await readOfflineCache<ProjectRow[]>(scope, NAMESPACE, "projects");
  return Array.isArray(raw) ? raw : null;
}

export async function writeCachedProjects(scope: string, projects: ProjectRow[]): Promise<void> {
  await writeOfflineCache(scope, NAMESPACE, "projects", projects);
}

export async function readCachedProjectItems(
  scope: string,
  projectId: number,
): Promise<TaskItemRow[] | null> {
  const raw = await readOfflineCache<TaskItemRow[]>(scope, NAMESPACE, `items:${projectId}`);
  return Array.isArray(raw) ? raw : null;
}

export async function writeCachedProjectItems(
  scope: string,
  projectId: number,
  items: TaskItemRow[],
): Promise<void> {
  await writeOfflineCache(scope, NAMESPACE, `items:${projectId}`, items);
}
