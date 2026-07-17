import { getSubjectKind } from "@freeanima/frontend/shell-sdk";

const EXPANDED_KEY_PREFIX = "task:folder-expanded";

export type TaskListRowLike = {
  id: number;
  name: string;
  sort_order: number;
  closed: boolean;
  is_folder: boolean;
  parent_id: number | null;
  item_count?: number;
};

export type ListTreeNode<T extends TaskListRowLike = TaskListRowLike> = {
  list: T;
  children: ListTreeNode<T>[];
  depth: number;
};

export function getParentId<T extends TaskListRowLike>(list: T): number | null {
  return list.parent_id ?? null;
}

export function getSiblings<T extends TaskListRowLike>(lists: T[], parentId: number | null): T[] {
  return lists
    .filter((l) => getParentId(l) === parentId)
    .toSorted((a, b) => a.sort_order - b.sort_order || a.id - b.id);
}

export function buildListTree<T extends TaskListRowLike>(lists: T[]): ListTreeNode<T>[] {
  function build(parentId: number | null, depth: number): ListTreeNode<T>[] {
    return getSiblings(lists, parentId).map((list) => ({
      list,
      depth,
      children: list.is_folder ? build(list.id, depth + 1) : [],
    }));
  }
  return build(null, 0);
}

export function flattenVisibleTree<T extends TaskListRowLike>(
  nodes: ListTreeNode<T>[],
  expandedFolderIds: Set<number>,
): ListTreeNode<T>[] {
  const out: ListTreeNode<T>[] = [];
  for (const node of nodes) {
    out.push(node);
    if (node.list.is_folder && expandedFolderIds.has(node.list.id)) {
      out.push(...flattenVisibleTree(node.children, expandedFolderIds));
    }
  }
  return out;
}

export function isDescendant<T extends TaskListRowLike>(
  lists: T[],
  ancestorId: number,
  nodeId: number,
): boolean {
  let current = lists.find((l) => l.id === nodeId);
  const visited = new Set<number>();
  while (current) {
    const parentId = getParentId(current);
    if (parentId == null) return false;
    if (parentId === ancestorId) return true;
    if (visited.has(parentId)) return false;
    visited.add(parentId);
    current = lists.find((l) => l.id === parentId);
  }
  return false;
}

export function collectFolderDescendantIds<T extends TaskListRowLike>(
  lists: T[],
  folderId: number,
): number[] {
  const out: number[] = [];
  const queue = [folderId];
  while (queue.length > 0) {
    const id = queue.shift();
    if (id === undefined) break;
    for (const child of lists.filter((l) => getParentId(l) === id)) {
      out.push(child.id);
      if (child.is_folder) queue.push(child.id);
    }
  }
  return out;
}

export function listPathLabel<T extends TaskListRowLike>(lists: T[], listId: number): string {
  const names: string[] = [];
  let current = lists.find((l) => l.id === listId);
  const visited = new Set<number>();
  while (current) {
    names.unshift(current.name);
    const parentId = getParentId(current);
    if (parentId == null) break;
    if (visited.has(parentId)) break;
    visited.add(parentId);
    current = lists.find((l) => l.id === parentId);
  }
  return names.join(" / ");
}

function expandedFoldersKey(): string {
  return `${EXPANDED_KEY_PREFIX}:${getSubjectKind()}`;
}

export function readExpandedFolders(): Set<number> {
  try {
    const raw = localStorage.getItem(expandedFoldersKey());
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((v): v is number => typeof v === "number"));
  } catch {
    return new Set();
  }
}

export function writeExpandedFolders(ids: Set<number>): void {
  try {
    localStorage.setItem(expandedFoldersKey(), JSON.stringify([...ids]));
  } catch {
    // ignore quota errors
  }
}

export function selectableLists<T extends TaskListRowLike>(lists: T[]): T[] {
  return lists.filter((l) => !l.is_folder && !l.closed);
}

/** 已归档清单平铺展示（不按文件夹树过滤，避免 parent 仍在活跃文件夹下时消失） */
export function sortedArchivedLists<T extends TaskListRowLike>(lists: T[]): T[] {
  return lists
    .filter((l) => l.closed && !l.is_folder)
    .toSorted((a, b) => a.sort_order - b.sort_order || a.id - b.id);
}
