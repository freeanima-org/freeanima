import { getParentId, getSiblings, isDescendant } from "@freeanima/ui-kit/lib/task-list-tree.ts";

import type { TaskListRow } from "./api.ts";
import { isListRootDndId, parseListDndId } from "./dnd-ids.ts";

export type FolderDropIntent = "before" | "after" | "into";

export type ListDragEndAction =
  | { type: "noop" }
  | { type: "move"; listId: number; parentId: number | null }
  | { type: "reorder"; ordered: TaskListRow[]; parentId: number | null }
  /** 跨 parent 放到某文件夹前后（同级），并带上目标 sibling 顺序 */
  | { type: "place"; listId: number; parentId: number | null; ordered: TaskListRow[] };

export type ResolveListDragEndOpts = {
  /** 松在文件夹行上时的位置意图；缺省 into */
  folderIntent?: FolderDropIntent;
};

/**
 * 根据指针在文件夹行上的垂直比例判断 before / into / after。
 * 上下缘较宽（约 38%），中间才算移入，避免「想排到文件夹后却进文件夹」。
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

function placeRelativeToFolder(
  lists: TaskListRow[],
  activeList: TaskListRow,
  overFolder: TaskListRow,
  intent: "before" | "after",
): ListDragEndAction {
  const targetParentId = getParentId(overFolder);
  const siblings = getSiblings(lists, targetParentId);
  const withoutActive = siblings.filter((l) => l.id !== activeList.id);
  const overIdx = withoutActive.findIndex((l) => l.id === overFolder.id);
  if (overIdx < 0) {
    return { type: "move", listId: activeList.id, parentId: targetParentId };
  }
  const insertAt = intent === "before" ? overIdx : overIdx + 1;
  const ordered = [
    ...withoutActive.slice(0, insertAt),
    { ...activeList, parent_id: targetParentId },
    ...withoutActive.slice(insertAt),
  ];
  if (getParentId(activeList) === targetParentId) {
    return { type: "reorder", ordered, parentId: targetParentId };
  }
  return { type: "place", listId: activeList.id, parentId: targetParentId, ordered };
}

/** 清单拖拽松手后的纯决策（便于单测）。 */
export function resolveListDragEnd(
  lists: TaskListRow[],
  activeListId: number,
  overId: string,
  opts?: ResolveListDragEndOpts,
): ListDragEndAction {
  const activeList = lists.find((l) => l.id === activeListId);
  if (!activeList || activeList.closed) return { type: "noop" };

  if (isListRootDndId(overId)) {
    if (getParentId(activeList) === null) return { type: "noop" };
    return { type: "move", listId: activeListId, parentId: null };
  }

  const overListId = parseListDndId(overId);
  if (overListId == null || overListId === activeListId) return { type: "noop" };

  const overList = lists.find((l) => l.id === overListId);
  if (!overList) return { type: "noop" };

  if (overList.is_folder) {
    if (isDescendant(lists, activeListId, overListId)) return { type: "noop" };

    const intent = opts?.folderIntent ?? "into";
    if (intent === "before" || intent === "after") {
      return placeRelativeToFolder(lists, activeList, overList, intent);
    }

    // into：松在当前父文件夹中间 → 上移一层
    if (getParentId(activeList) === overListId) {
      return { type: "move", listId: activeListId, parentId: getParentId(overList) };
    }
    return { type: "move", listId: activeListId, parentId: overListId };
  }

  const targetParentId = getParentId(overList);
  const siblings = getSiblings(lists, targetParentId);
  const from = siblings.findIndex((l) => l.id === activeListId);
  const to = siblings.findIndex((l) => l.id === overListId);
  if (from < 0 || to < 0) {
    if (isDescendant(lists, activeListId, overListId)) return { type: "noop" };
    if (getParentId(activeList) === targetParentId) return { type: "noop" };
    return { type: "move", listId: activeListId, parentId: targetParentId };
  }
  if (getParentId(activeList) !== targetParentId) {
    return { type: "move", listId: activeListId, parentId: targetParentId };
  }
  if (from !== to) {
    return {
      type: "reorder",
      ordered: arrayMove(siblings, from, to),
      parentId: targetParentId,
    };
  }
  return { type: "noop" };
}

function arrayMove<T>(items: T[], from: number, to: number): T[] {
  const next = [...items];
  const [removed] = next.splice(from, 1);
  if (removed === undefined) return items;
  next.splice(to, 0, removed);
  return next;
}
