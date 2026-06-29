import type { TaskListRow } from "../lib/api.ts";
import { buildListTree, flattenVisibleTree, type ListTreeNode } from "../lib/list-tree.ts";

type MoveToListPickerProps = {
  lists: TaskListRow[];
  currentListId: number | null;
  title?: string;
  onSelect: (listId: number) => void;
  onClose: () => void;
};

function TreePickerRows({
  nodes,
  expandedFolderIds,
  currentListId,
  onSelect,
  onClose,
}: {
  nodes: ListTreeNode[];
  expandedFolderIds: Set<number>;
  currentListId: number | null;
  onSelect: (listId: number) => void;
  onClose: () => void;
}) {
  const visible = flattenVisibleTree(nodes, expandedFolderIds);
  const selectable = visible.filter((n) => !n.list.is_folder && n.list.id !== currentListId);

  if (selectable.length === 0) {
    return <p className="text-base-content/60 px-4 py-6 text-sm">没有其它清单可移动</p>;
  }

  return (
    <ul className="menu menu-lg max-h-[50vh] overflow-y-auto rounded-none p-2">
      {selectable.map(({ list, depth }) => (
        <li key={list.id}>
          <button
            type="button"
            style={{ paddingLeft: `${12 + depth * 16}px` }}
            onClick={() => {
              onSelect(list.id);
              onClose();
            }}
          >
            <span className="truncate">{list.name}</span>
            <span className="text-base-content/50 text-xs">{list.item_count}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function MoveToListPicker({
  lists,
  currentListId,
  title = "移动到清单",
  onSelect,
  onClose,
}: MoveToListPickerProps) {
  const activeLists = lists.filter((l) => !l.closed);
  const tree = buildListTree(activeLists);
  const expandedFolderIds = new Set(activeLists.filter((l) => l.is_folder).map((l) => l.id));

  return (
    <dialog open className="modal modal-open modal-bottom sm:modal-middle">
      <div className="modal-box safe-area-pb w-full max-w-lg rounded-t-2xl p-0 sm:rounded-box">
        <div className="border-base-300 border-b px-4 py-3">
          <p className="text-sm font-semibold">{title}</p>
        </div>
        <TreePickerRows
          nodes={tree}
          expandedFolderIds={expandedFolderIds}
          currentListId={currentListId}
          onSelect={onSelect}
          onClose={onClose}
        />
        <div className="border-base-300 border-t p-2">
          <button type="button" className="btn btn-ghost btn-block" onClick={onClose}>
            取消
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="button" onClick={onClose}>
          close
        </button>
      </form>
    </dialog>
  );
}
