import { useMemo, useState, type ReactNode } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Sheet,
  SheetContent,
} from "@freeanima/ui-kit";
import { useMobileLayout } from "@freeanima/ui-kit/layout";

import type { TaskListRow } from "../lib/api.ts";
import {
  buildListTree,
  flattenVisibleTree,
  listPathLabel,
  readExpandedFolders,
  type ListTreeNode,
} from "../lib/list-tree.ts";

type MoveToListPickerProps = {
  lists: TaskListRow[];
  currentListId: number | null;
  title?: string;
  onSelect: (listId: number) => void;
  onClose: () => void;
};

function filterTreeForSearch(
  nodes: ListTreeNode[],
  query: string,
): { nodes: ListTreeNode[]; expandedFolderIds: Set<number> } {
  const q = query.trim().toLowerCase();
  if (!q) return { nodes, expandedFolderIds: new Set() };

  const expandedFolderIds = new Set<number>();

  function prune(node: ListTreeNode): ListTreeNode | null {
    const nameMatch = node.list.name.toLowerCase().includes(q);
    const prunedChildren = node.list.is_folder
      ? node.children.map(prune).filter((n): n is ListTreeNode => n != null)
      : [];

    if (node.list.is_folder) {
      if (nameMatch || prunedChildren.length > 0) {
        if (prunedChildren.length > 0) expandedFolderIds.add(node.list.id);
        return { ...node, children: prunedChildren };
      }
      return null;
    }

    return nameMatch ? node : null;
  }

  const filtered = nodes.map(prune).filter((n): n is ListTreeNode => n != null);
  return { nodes: filtered, expandedFolderIds };
}

function TreePickerRows({
  nodes,
  expandedFolderIds,
  currentListId,
  searchQuery,
  allLists,
  onToggleExpand,
  onSelect,
  onClose,
}: {
  nodes: ListTreeNode[];
  expandedFolderIds: Set<number>;
  currentListId: number | null;
  searchQuery: string;
  allLists: TaskListRow[];
  onToggleExpand: (folderId: number) => void;
  onSelect: (listId: number) => void;
  onClose: () => void;
}) {
  const searching = searchQuery.trim().length > 0;
  const visible = flattenVisibleTree(nodes, expandedFolderIds);
  const selectable = visible.filter((n) => !n.list.is_folder && n.list.id !== currentListId);

  if (selectable.length === 0) {
    return (
      <p className="text-muted-foreground px-4 py-6 text-sm">
        {searching ? "没有匹配的清单" : "没有其它清单可移动"}
      </p>
    );
  }

  if (searching) {
    return (
      <ul className="max-h-[50vh] overflow-y-auto p-2">
        {selectable.map(({ list }) => (
          <li key={list.id}>
            <button
              type="button"
              className="hover:bg-muted flex w-full min-h-11 items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm"
              onClick={() => {
                onSelect(list.id);
                onClose();
              }}
            >
              <span className="min-w-0 flex-1 truncate">{listPathLabel(allLists, list.id)}</span>
              <span className="text-muted-foreground shrink-0 text-xs">{list.item_count}</span>
            </button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className="max-h-[50vh] overflow-y-auto p-2">
      {visible.map((node) => {
        const { list, depth } = node;
        const isFolder = list.is_folder;
        const isCurrent = !isFolder && list.id === currentListId;

        if (isCurrent) return null;

        if (isFolder) {
          const expanded = expandedFolderIds.has(list.id);
          return (
            <li key={list.id}>
              <div
                style={{ paddingLeft: `${8 + depth * 16}px` }}
                className="flex min-h-11 w-full items-center gap-1 rounded-lg pr-2"
              >
                <button
                  type="button"
                  className="text-muted-foreground flex min-h-11 min-w-6 shrink-0 items-center justify-center"
                  aria-label={expanded ? "折叠" : "展开"}
                  onClick={() => onToggleExpand(list.id)}
                >
                  {expanded ? "▼" : "▶"}
                </button>
                <span className="min-w-0 flex-1 truncate py-2 text-left text-sm">
                  <span className="mr-1" aria-hidden>
                    📁
                  </span>
                  {list.name}
                </span>
              </div>
            </li>
          );
        }

        return (
          <li key={list.id}>
            <button
              type="button"
              style={{ paddingLeft: `${8 + depth * 16 + 24}px` }}
              className="hover:bg-muted flex w-full min-h-11 items-center justify-between gap-3 rounded-lg py-2 pr-3 text-left text-sm"
              onClick={() => {
                onSelect(list.id);
                onClose();
              }}
            >
              <span className="min-w-0 flex-1 truncate">{list.name}</span>
              <span className="text-muted-foreground shrink-0 text-xs">{list.item_count}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function MoveToListPickerBody({
  title,
  searchQuery,
  onSearchChange,
  children,
  onClose,
}: {
  title: string;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <>
      <div className="border-b px-4 py-3">
        <p className="text-sm font-semibold">{title}</p>
        <Input
          type="search"
          className="mt-2 h-8 w-full"
          placeholder="搜索清单…"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          autoFocus
        />
      </div>
      {children}
      <div className="border-t p-2">
        <Button type="button" variant="ghost" className="w-full" onClick={onClose}>
          取消
        </Button>
      </div>
    </>
  );
}

export function MoveToListPicker({
  lists,
  currentListId,
  title = "移动到清单",
  onSelect,
  onClose,
}: MoveToListPickerProps) {
  const mobileLayout = useMobileLayout();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<number>>(() => {
    const saved = readExpandedFolders();
    if (saved.size > 0) return saved;
    return new Set(lists.filter((l) => l.is_folder).map((l) => l.id));
  });

  const tree = useMemo(() => buildListTree(lists), [lists]);

  const { nodes: displayTree, expandedFolderIds: searchExpandedIds } = useMemo(
    () => filterTreeForSearch(tree, searchQuery),
    [tree, searchQuery],
  );

  const effectiveExpandedIds = useMemo(() => {
    if (searchQuery.trim()) return searchExpandedIds;
    return expandedFolderIds;
  }, [searchQuery, searchExpandedIds, expandedFolderIds]);

  const toggleExpand = (folderId: number) => {
    setExpandedFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const treeRows = (
    <TreePickerRows
      nodes={displayTree}
      expandedFolderIds={effectiveExpandedIds}
      currentListId={currentListId}
      searchQuery={searchQuery}
      allLists={lists}
      onToggleExpand={toggleExpand}
      onSelect={onSelect}
      onClose={onClose}
    />
  );

  if (mobileLayout) {
    return (
      <Sheet open onOpenChange={(open) => !open && onClose()}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="safe-area-pb max-h-[85vh] gap-0 rounded-t-2xl p-0"
        >
          <MoveToListPickerBody
            title={title}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onClose={onClose}
          >
            {treeRows}
          </MoveToListPickerBody>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="space-y-2 border-b px-4 py-3 text-left">
          <DialogTitle className="text-sm">{title}</DialogTitle>
          <Input
            type="search"
            className="h-8 w-full"
            placeholder="搜索清单…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
        </DialogHeader>
        {treeRows}
        <DialogFooter className="border-t p-2 sm:justify-stretch">
          <Button type="button" variant="ghost" className="w-full" onClick={onClose}>
            取消
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
