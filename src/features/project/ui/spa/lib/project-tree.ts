import type { ProjectFolderRow, ProjectRow } from "./api.ts";

const EXPANDED_KEY_PREFIX = "project:folder-expanded";

export type ProjectTreeNode =
  | { kind: "folder"; folder: ProjectFolderRow; depth: number; children: ProjectTreeNode[] }
  | { kind: "project"; project: ProjectRow; depth: number };

export function folderSiblings(
  folders: ProjectFolderRow[],
  parentId: number | null,
): ProjectFolderRow[] {
  return folders
    .filter((f) => (f.parent_id ?? null) === parentId)
    .toSorted((a, b) => a.sort_order - b.sort_order || a.id - b.id);
}

export function projectsInFolder(projects: ProjectRow[], folderId: number | null): ProjectRow[] {
  return projects
    .filter((p) => (p.folder_id ?? null) === folderId)
    .toSorted((a, b) => a.sort_order - b.sort_order || a.id - b.id);
}

/** 判断 nodeId 是否在 ancestorId 文件夹子树内（不含自身）。 */
export function isFolderDescendant(
  folders: ProjectFolderRow[],
  ancestorId: number,
  nodeId: number,
): boolean {
  let current = folders.find((f) => f.id === nodeId);
  const visited = new Set<number>();
  while (current) {
    const parentId = current.parent_id ?? null;
    if (parentId == null) return false;
    if (parentId === ancestorId) return true;
    if (visited.has(parentId)) return false;
    visited.add(parentId);
    current = folders.find((f) => f.id === parentId);
  }
  return false;
}

export function buildProjectTree(
  folders: ProjectFolderRow[],
  projects: ProjectRow[],
): ProjectTreeNode[] {
  function buildFolders(parentId: number | null, depth: number): ProjectTreeNode[] {
    const nodes: ProjectTreeNode[] = [];
    for (const folder of folderSiblings(folders, parentId)) {
      const childFolders = buildFolders(folder.id, depth + 1);
      const childProjects = projectsInFolder(projects, folder.id).map(
        (project): ProjectTreeNode => ({ kind: "project", project, depth: depth + 1 }),
      );
      nodes.push({
        kind: "folder",
        folder,
        depth,
        children: [...childFolders, ...childProjects],
      });
    }
    return nodes;
  }

  const rootFolders = buildFolders(null, 0);
  const rootProjects = projectsInFolder(projects, null).map(
    (project): ProjectTreeNode => ({ kind: "project", project, depth: 0 }),
  );
  return [...rootFolders, ...rootProjects];
}

export function flattenVisibleProjectTree(
  nodes: ProjectTreeNode[],
  expandedFolderIds: Set<number>,
): ProjectTreeNode[] {
  const out: ProjectTreeNode[] = [];
  for (const node of nodes) {
    out.push(node);
    if (node.kind === "folder" && expandedFolderIds.has(node.folder.id)) {
      out.push(...flattenVisibleProjectTree(node.children, expandedFolderIds));
    }
  }
  return out;
}

export function readExpandedProjectFolders(subjectKind: string): Set<number> {
  try {
    const raw = localStorage.getItem(`${EXPANDED_KEY_PREFIX}:${subjectKind}`);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is number => typeof id === "number" && id > 0));
  } catch {
    return new Set();
  }
}

export function writeExpandedProjectFolders(subjectKind: string, ids: Set<number>): void {
  try {
    localStorage.setItem(
      `${EXPANDED_KEY_PREFIX}:${subjectKind}`,
      JSON.stringify([...ids].toSorted((a, b) => a - b)),
    );
  } catch {
    // ignore
  }
}

const HIDE_COMPLETED_KEY_PREFIX = "freeanima.project.hide-completed";

export function readHideCompleted(subjectKind: string): boolean {
  try {
    return localStorage.getItem(`${HIDE_COMPLETED_KEY_PREFIX}:${subjectKind}`) === "1";
  } catch {
    return false;
  }
}

export function writeHideCompleted(subjectKind: string, hide: boolean): void {
  try {
    localStorage.setItem(`${HIDE_COMPLETED_KEY_PREFIX}:${subjectKind}`, hide ? "1" : "0");
  } catch {
    // ignore
  }
}

export function folderIdForNewProject(
  selectedProjectId: number | null,
  selectedFolderId: number | null,
  projects: ProjectRow[],
): number | null {
  if (selectedProjectId != null) {
    const project = projects.find((p) => p.id === selectedProjectId);
    return project?.folder_id ?? null;
  }
  return selectedFolderId;
}
