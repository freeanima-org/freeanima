import type { ProjectFolderRow, ProjectRow } from "./api.ts";
import {
  isProjectRootDndId,
  parseProjectFolderDndId,
  parseProjectItemDndId,
} from "./project-dnd-ids.ts";
import { folderSiblings, isFolderDescendant, projectsInFolder } from "./project-tree.ts";

export type FolderDropIntent = "before" | "after" | "into";

export type ProjectDragEndAction =
  | { type: "noop" }
  | { type: "moveFolder"; folderId: number; parentId: number | null }
  | { type: "reorderFolders"; ordered: ProjectFolderRow[]; parentId: number | null }
  | {
      type: "placeFolder";
      folderId: number;
      parentId: number | null;
      ordered: ProjectFolderRow[];
    }
  | { type: "moveProject"; projectId: number; folderId: number | null }
  | { type: "reorderProjects"; ordered: ProjectRow[]; folderId: number | null }
  | {
      type: "placeProject";
      projectId: number;
      folderId: number | null;
      ordered: ProjectRow[];
    };

export type ResolveProjectDragEndOpts = {
  folderIntent?: FolderDropIntent;
  /** 松在项目行上时：上半 before / 下半 after */
  projectIntent?: "before" | "after";
};

/**
 * 指针在文件夹行上的垂直比例 → before / into / after。
 * 上下缘约 38%，中间才算移入。
 */
export function resolveFolderDropIntent(
  overRect: { top: number; height: number },
  pointerY: number,
): FolderDropIntent {
  if (overRect.height <= 0) return "into";
  const ratio = (pointerY - overRect.top) / overRect.height;
  if (ratio < 0.38) return "before";
  if (ratio > 0.62) return "after";
  return "into";
}

export function resolveProjectRowDropIntent(
  overRect: { top: number; height: number },
  pointerY: number,
): "before" | "after" {
  if (overRect.height <= 0) return "after";
  const ratio = (pointerY - overRect.top) / overRect.height;
  return ratio < 0.5 ? "before" : "after";
}

function placeFolderRelative(
  folders: ProjectFolderRow[],
  active: ProjectFolderRow,
  overFolder: ProjectFolderRow,
  intent: "before" | "after",
): ProjectDragEndAction {
  const targetParentId = overFolder.parent_id ?? null;
  const siblings = folderSiblings(folders, targetParentId);
  const withoutActive = siblings.filter((f) => f.id !== active.id);
  const overIdx = withoutActive.findIndex((f) => f.id === overFolder.id);
  if (overIdx < 0) {
    return { type: "moveFolder", folderId: active.id, parentId: targetParentId };
  }
  const insertAt = intent === "before" ? overIdx : overIdx + 1;
  const ordered = [
    ...withoutActive.slice(0, insertAt),
    { ...active, parent_id: targetParentId },
    ...withoutActive.slice(insertAt),
  ];
  if ((active.parent_id ?? null) === targetParentId) {
    return { type: "reorderFolders", ordered, parentId: targetParentId };
  }
  return { type: "placeFolder", folderId: active.id, parentId: targetParentId, ordered };
}

function placeProjectRelative(
  projects: ProjectRow[],
  active: ProjectRow,
  overProject: ProjectRow,
  intent: "before" | "after",
): ProjectDragEndAction {
  const targetFolderId = overProject.folder_id ?? null;
  const siblings = projectsInFolder(projects, targetFolderId);
  const withoutActive = siblings.filter((p) => p.id !== active.id);
  const overIdx = withoutActive.findIndex((p) => p.id === overProject.id);
  if (overIdx < 0) {
    return { type: "moveProject", projectId: active.id, folderId: targetFolderId };
  }
  const insertAt = intent === "before" ? overIdx : overIdx + 1;
  const ordered = [
    ...withoutActive.slice(0, insertAt),
    { ...active, folder_id: targetFolderId },
    ...withoutActive.slice(insertAt),
  ];
  if ((active.folder_id ?? null) === targetFolderId) {
    return { type: "reorderProjects", ordered, folderId: targetFolderId };
  }
  return { type: "placeProject", projectId: active.id, folderId: targetFolderId, ordered };
}

function placeProjectBesideFolder(
  projects: ProjectRow[],
  active: ProjectRow,
  overFolder: ProjectFolderRow,
  intent: "before" | "after",
): ProjectDragEndAction {
  const targetFolderId = overFolder.parent_id ?? null;
  const siblings = projectsInFolder(projects, targetFolderId).filter((p) => p.id !== active.id);
  // 树渲染为「文件夹在前、项目在后」：before≈插到项目区开头，after≈末尾
  const ordered =
    intent === "before"
      ? [{ ...active, folder_id: targetFolderId }, ...siblings]
      : [...siblings, { ...active, folder_id: targetFolderId }];
  if ((active.folder_id ?? null) === targetFolderId) {
    return { type: "reorderProjects", ordered, folderId: targetFolderId };
  }
  return { type: "placeProject", projectId: active.id, folderId: targetFolderId, ordered };
}

/** 项目树拖拽松手后的纯决策（便于单测）。 */
export function resolveProjectDragEnd(
  folders: ProjectFolderRow[],
  projects: ProjectRow[],
  activeId: string,
  overId: string,
  opts?: ResolveProjectDragEndOpts,
): ProjectDragEndAction {
  const activeFolderId = parseProjectFolderDndId(activeId);
  const activeProjectId = parseProjectItemDndId(activeId);

  if (activeFolderId != null) {
    const activeFolder = folders.find((f) => f.id === activeFolderId);
    if (!activeFolder) return { type: "noop" };

    if (isProjectRootDndId(overId)) {
      if ((activeFolder.parent_id ?? null) === null) return { type: "noop" };
      return { type: "moveFolder", folderId: activeFolderId, parentId: null };
    }

    const overFolderId = parseProjectFolderDndId(overId);
    if (overFolderId != null) {
      if (overFolderId === activeFolderId) return { type: "noop" };
      if (isFolderDescendant(folders, activeFolderId, overFolderId)) return { type: "noop" };
      const overFolder = folders.find((f) => f.id === overFolderId);
      if (!overFolder) return { type: "noop" };

      const intent = opts?.folderIntent ?? "into";
      if (intent === "before" || intent === "after") {
        return placeFolderRelative(folders, activeFolder, overFolder, intent);
      }
      // into：松在当前父文件夹中间 → 上移一层
      if ((activeFolder.parent_id ?? null) === overFolderId) {
        return {
          type: "moveFolder",
          folderId: activeFolderId,
          parentId: overFolder.parent_id ?? null,
        };
      }
      return { type: "moveFolder", folderId: activeFolderId, parentId: overFolderId };
    }

    const overProjectId = parseProjectItemDndId(overId);
    if (overProjectId != null) {
      const overProject = projects.find((p) => p.id === overProjectId);
      if (!overProject) return { type: "noop" };
      const targetParentId = overProject.folder_id ?? null;
      if ((activeFolder.parent_id ?? null) === targetParentId) return { type: "noop" };
      return { type: "moveFolder", folderId: activeFolderId, parentId: targetParentId };
    }

    return { type: "noop" };
  }

  if (activeProjectId != null) {
    const activeProject = projects.find((p) => p.id === activeProjectId);
    if (!activeProject) return { type: "noop" };

    if (isProjectRootDndId(overId)) {
      if ((activeProject.folder_id ?? null) === null) return { type: "noop" };
      return { type: "moveProject", projectId: activeProjectId, folderId: null };
    }

    const overFolderId = parseProjectFolderDndId(overId);
    if (overFolderId != null) {
      const overFolder = folders.find((f) => f.id === overFolderId);
      if (!overFolder) return { type: "noop" };
      const intent = opts?.folderIntent ?? "into";
      if (intent === "before" || intent === "after") {
        return placeProjectBesideFolder(projects, activeProject, overFolder, intent);
      }
      if ((activeProject.folder_id ?? null) === overFolderId) return { type: "noop" };
      return { type: "moveProject", projectId: activeProjectId, folderId: overFolderId };
    }

    const overProjectId = parseProjectItemDndId(overId);
    if (overProjectId != null) {
      if (overProjectId === activeProjectId) return { type: "noop" };
      const overProject = projects.find((p) => p.id === overProjectId);
      if (!overProject) return { type: "noop" };
      const projectIntent = opts?.projectIntent ?? "after";
      return placeProjectRelative(projects, activeProject, overProject, projectIntent);
    }

    return { type: "noop" };
  }

  return { type: "noop" };
}
