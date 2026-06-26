import type { TaskListRow } from "../lib/api.ts";

type MoveToListPickerProps = {
  lists: TaskListRow[];
  currentListId: number | null;
  title?: string;
  onSelect: (listId: number) => void;
  onClose: () => void;
};

export function MoveToListPicker({
  lists,
  currentListId,
  title = "移动到清单",
  onSelect,
  onClose,
}: MoveToListPickerProps) {
  const targets = lists.filter((l) => l.id !== currentListId);

  return (
    <dialog open className="modal modal-open modal-bottom sm:modal-middle">
      <div className="modal-box w-full max-w-lg rounded-t-2xl p-0 sm:rounded-box safe-area-pb">
        <div className="border-base-300 border-b px-4 py-3">
          <p className="text-sm font-semibold">{title}</p>
        </div>
        {targets.length === 0 ? (
          <p className="text-base-content/60 px-4 py-6 text-sm">没有其它清单可移动</p>
        ) : (
          <ul className="menu menu-lg max-h-[50vh] overflow-y-auto rounded-none p-2">
            {targets.map((list) => (
              <li key={list.id}>
                <button
                  type="button"
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
        )}
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
