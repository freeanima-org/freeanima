const FOLDER_PREFIX = "project-folder:";
const PROJECT_PREFIX = "project-item:";

/** 侧栏「移到顶级」根 drop 目标 */
export const PROJECT_ROOT_DND_ID = "project-root";

export function projectFolderDndId(id: number): string {
  return `${FOLDER_PREFIX}${id}`;
}

export function projectItemDndId(id: number): string {
  return `${PROJECT_PREFIX}${id}`;
}

export function isProjectRootDndId(id: string | number): boolean {
  return String(id) === PROJECT_ROOT_DND_ID;
}

export function parseProjectFolderDndId(id: string | number): number | null {
  const raw = String(id);
  if (!raw.startsWith(FOLDER_PREFIX)) return null;
  const n = Number(raw.slice(FOLDER_PREFIX.length));
  return Number.isFinite(n) ? n : null;
}

export function parseProjectItemDndId(id: string | number): number | null {
  const raw = String(id);
  if (!raw.startsWith(PROJECT_PREFIX)) return null;
  const n = Number(raw.slice(PROJECT_PREFIX.length));
  return Number.isFinite(n) ? n : null;
}

export function isProjectFolderDndId(id: string | number): boolean {
  return parseProjectFolderDndId(id) != null;
}

export function isProjectItemDndId(id: string | number): boolean {
  return parseProjectItemDndId(id) != null;
}

export function isProjectTreeDndId(id: string | number): boolean {
  return isProjectFolderDndId(id) || isProjectItemDndId(id);
}
