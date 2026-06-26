import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { FormFieldLabel, FormFieldset } from "@freeanima/satellite-sdk/form";

import { ContextMenu, type ContextMenuItem } from "./components/ContextMenu.tsx";
import {
  completeTaskItem,
  createTaskItem,
  createTaskList,
  deleteTaskItem,
  deleteTaskList,
  fetchTaskItems,
  fetchTaskLists,
  uncompleteTaskItem,
  updateTaskItem,
  updateTaskList,
  type TaskItemRow,
  type TaskListRow,
} from "./lib/api.ts";
import { isTaskContextMenuEnabled } from "./lib/platform.ts";
import { reorderIds, sortOrderUpdates } from "./lib/reorder.ts";

type ListMenuState = { x: number; y: number; listId: number };
type ItemMenuState = { x: number; y: number; itemId: number };

function priorityDot(priority: TaskItemRow["priority"]): string {
  switch (priority) {
    case "high":
      return "text-error";
    case "medium":
      return "text-warning";
    case "low":
      return "text-info";
    default:
      return "text-base-content/30";
  }
}

function formatDue(due: string | null): string {
  if (!due) return "";
  const d = new Date(due);
  if (Number.isNaN(d.getTime())) return due;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function TaskApp() {
  const contextMenuEnabled = isTaskContextMenuEnabled();
  const renameInputRef = useRef<HTMLInputElement>(null);

  const [lists, setLists] = useState<TaskListRow[]>([]);
  const [items, setItems] = useState<TaskItemRow[]>([]);
  const [selectedListId, setSelectedListId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newListName, setNewListName] = useState("");
  const [quickTitle, setQuickTitle] = useState("");
  const [editingItem, setEditingItem] = useState<TaskItemRow | null>(null);

  const [editingListId, setEditingListId] = useState<number | null>(null);
  const [editingListName, setEditingListName] = useState("");

  const [listMenu, setListMenu] = useState<ListMenuState | null>(null);
  const [itemMenu, setItemMenu] = useState<ItemMenuState | null>(null);

  const [dragListId, setDragListId] = useState<number | null>(null);
  const [dropListId, setDropListId] = useState<number | null>(null);
  const [dragItemId, setDragItemId] = useState<number | null>(null);
  const [dropItemId, setDropItemId] = useState<number | null>(null);

  const loadLists = useCallback(async () => {
    const rows = await fetchTaskLists();
    setLists(rows);
    if (rows.length === 0) {
      setSelectedListId(null);
      setItems([]);
      return;
    }
    setSelectedListId((prev) => {
      if (prev != null && rows.some((l) => l.id === prev)) return prev;
      return rows[0]!.id;
    });
  }, []);

  const loadItems = useCallback(async (listId: number) => {
    const rows = await fetchTaskItems(listId);
    setItems(rows);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      await loadLists();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [loadLists]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (selectedListId == null) return;
    void loadItems(selectedListId).catch((err) => {
      setError(err instanceof Error ? err.message : String(err));
    });
  }, [selectedListId, loadItems]);

  useEffect(() => {
    if (editingListId == null) return;
    renameInputRef.current?.focus();
    renameInputRef.current?.select();
  }, [editingListId]);

  const handleCreateList = async () => {
    const name = newListName.trim();
    if (!name) return;
    try {
      const list = await createTaskList(name);
      setNewListName("");
      await loadLists();
      setSelectedListId(list.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const startRenameList = (list: TaskListRow) => {
    setEditingListId(list.id);
    setEditingListName(list.name);
  };

  const commitRenameList = async () => {
    if (editingListId == null) return;
    const name = editingListName.trim();
    setEditingListId(null);
    if (!name) return;
    const current = lists.find((l) => l.id === editingListId);
    if (!current || current.name === name) return;
    try {
      await updateTaskList(editingListId, { name });
      await loadLists();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDeleteList = async (list: TaskListRow) => {
    if (!confirm(`删除清单「${list.name}」及其任务？`)) return;
    try {
      await deleteTaskList(list.id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const persistListOrder = async (ordered: TaskListRow[]) => {
    setLists(ordered.map((list, index) => ({ ...list, sort_order: index })));
    const updates = sortOrderUpdates(ordered);
    try {
      await Promise.all(updates.map((u) => updateTaskList(u.id, { sort_order: u.sort_order })));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      await loadLists();
    }
  };

  const persistItemOrder = async (orderedPending: TaskItemRow[]) => {
    const completed = items.filter((i) => i.status === "completed");
    const merged = [...orderedPending, ...completed];
    setItems(merged.map((item, index) => ({ ...item, sort_order: index })));
    const updates = sortOrderUpdates(orderedPending);
    try {
      await Promise.all(updates.map((u) => updateTaskItem(u.id, { sort_order: u.sort_order })));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      if (selectedListId != null) await loadItems(selectedListId);
    }
  };

  const handleQuickAdd = async () => {
    const title = quickTitle.trim();
    if (!title || selectedListId == null) return;
    try {
      const pending = items.filter((i) => i.status === "pending");
      await createTaskItem({ title, list_id: selectedListId, sort_order: pending.length });
      setQuickTitle("");
      await Promise.all([loadItems(selectedListId), loadLists()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const toggleComplete = async (item: TaskItemRow) => {
    try {
      if (item.status === "completed") {
        await uncompleteTaskItem(item.id);
      } else {
        await completeTaskItem(item.id);
      }
      if (selectedListId != null) {
        await Promise.all([loadItems(selectedListId), loadLists()]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDeleteItem = async (item: TaskItemRow) => {
    try {
      await deleteTaskItem(item.id);
      if (selectedListId != null) {
        await Promise.all([loadItems(selectedListId), loadLists()]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const saveEditingItem = async () => {
    if (!editingItem) return;
    try {
      await updateTaskItem(editingItem.id, {
        title: editingItem.title,
        priority: editingItem.priority,
        due_at: editingItem.due_at,
        note: editingItem.note,
      });
      setEditingItem(null);
      if (selectedListId != null) await loadItems(selectedListId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const selectedList = lists.find((l) => l.id === selectedListId) ?? null;
  const pendingItems = items.filter((i) => i.status === "pending");
  const completedItems = items.filter((i) => i.status === "completed");

  const menuList = listMenu ? lists.find((l) => l.id === listMenu.listId) : null;
  const menuItem = itemMenu ? items.find((i) => i.id === itemMenu.itemId) : null;

  const listMenuItems: ContextMenuItem[] = menuList
    ? [
        {
          label: "重命名",
          onClick: () => startRenameList(menuList),
        },
        {
          label: "删除",
          danger: true,
          onClick: () => void handleDeleteList(menuList),
        },
      ]
    : [];

  const itemMenuItems: ContextMenuItem[] = menuItem
    ? [
        {
          label: "编辑",
          onClick: () => setEditingItem({ ...menuItem }),
        },
        {
          label: menuItem.status === "completed" ? "标记未完成" : "标记完成",
          onClick: () => void toggleComplete(menuItem),
        },
        {
          label: "删除",
          danger: true,
          onClick: () => void handleDeleteItem(menuItem),
        },
      ]
    : [];

  const openListMenu = (e: MouseEvent, listId: number) => {
    if (!contextMenuEnabled) return;
    e.preventDefault();
    e.stopPropagation();
    setItemMenu(null);
    setListMenu({ x: e.clientX, y: e.clientY, listId });
  };

  const openItemMenu = (e: MouseEvent, itemId: number) => {
    if (!contextMenuEnabled) return;
    e.preventDefault();
    e.stopPropagation();
    setListMenu(null);
    setItemMenu({ x: e.clientX, y: e.clientY, itemId });
  };

  return (
    <div className="flex h-full min-h-0 flex-col lg:flex-row">
      <aside className="border-base-300 flex w-full shrink-0 flex-col border-b lg:w-56 lg:border-b-0 lg:border-r">
        <div className="border-base-300 border-b p-3">
          <h2 className="text-sm font-semibold">清单</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {lists.map((list) => {
            const isDropTarget = dropListId === list.id && dragListId !== list.id;
            const isDragging = dragListId === list.id;
            return (
              <div
                key={list.id}
                className={`group flex items-center gap-0.5 rounded-lg px-1 py-1 text-sm ${
                  selectedListId === list.id ? "bg-primary/15 font-medium" : "hover:bg-base-200"
                } ${isDropTarget ? "ring-primary ring-2" : ""} ${isDragging ? "opacity-50" : ""}`}
                onDragOver={(e) => {
                  if (dragListId == null) return;
                  e.preventDefault();
                  setDropListId(list.id);
                }}
                onDragLeave={() => {
                  if (dropListId === list.id) setDropListId(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragListId == null) return;
                  const ordered = reorderIds(lists, dragListId, list.id);
                  setDragListId(null);
                  setDropListId(null);
                  void persistListOrder(ordered);
                }}
                onContextMenu={(e) => openListMenu(e, list.id)}
                onDoubleClick={() => startRenameList(list)}
              >
                <span
                  draggable
                  title="拖拽排序"
                  className="text-base-content/40 hover:text-base-content cursor-grab px-0.5 select-none active:cursor-grabbing"
                  onDragStart={(e) => {
                    setDragListId(list.id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragEnd={() => {
                    setDragListId(null);
                    setDropListId(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  ⋮⋮
                </span>
                {editingListId === list.id ? (
                  <input
                    ref={renameInputRef}
                    className="input input-xs input-bordered min-w-0 flex-1"
                    value={editingListName}
                    onChange={(e) => setEditingListName(e.target.value)}
                    onBlur={() => void commitRenameList()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void commitRenameList();
                      if (e.key === "Escape") setEditingListId(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate py-0.5 text-left"
                    onClick={() => setSelectedListId(list.id)}
                  >
                    {list.name}
                    <span className="text-base-content/50 ml-1 text-xs">{list.item_count}</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <div className="border-base-300 flex gap-1 border-t p-2">
          <input
            className="input input-sm input-bordered min-w-0 flex-1"
            placeholder="新清单"
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleCreateList();
            }}
          />
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => void handleCreateList()}
          >
            +
          </button>
        </div>
      </aside>

      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="border-base-300 flex items-center justify-between border-b px-4 py-3">
          <h1 className="text-lg font-semibold">{selectedList?.name ?? "任务"}</h1>
          {loading ? <span className="loading loading-spinner loading-sm" /> : null}
        </header>

        {error ? (
          <div className="alert alert-error m-3 text-sm">
            <span>{error}</span>
            <button type="button" className="btn btn-ghost btn-xs" onClick={() => setError("")}>
              关闭
            </button>
          </div>
        ) : null}

        {!selectedList && !loading ? (
          <div className="text-base-content/60 flex flex-1 items-center justify-center p-8 text-sm">
            创建第一个清单开始使用
          </div>
        ) : null}

        {selectedList ? (
          <>
            <div className="flex-1 overflow-y-auto px-2 py-2">
              {pendingItems.length === 0 && completedItems.length === 0 ? (
                <p className="text-base-content/50 px-2 py-6 text-sm">暂无任务，在下方快速添加</p>
              ) : null}

              <ul className="space-y-1">
                {pendingItems.map((item) => {
                  const isDropTarget = dropItemId === item.id && dragItemId !== item.id;
                  const isDragging = dragItemId === item.id;
                  return (
                    <li
                      key={item.id}
                      className={`hover:bg-base-200 group flex items-center gap-1 rounded-lg px-1 py-2 ${
                        isDropTarget ? "ring-primary ring-2" : ""
                      } ${isDragging ? "opacity-50" : ""}`}
                      onDragOver={(e) => {
                        if (dragItemId == null) return;
                        e.preventDefault();
                        setDropItemId(item.id);
                      }}
                      onDragLeave={() => {
                        if (dropItemId === item.id) setDropItemId(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (dragItemId == null) return;
                        const ordered = reorderIds(pendingItems, dragItemId, item.id);
                        setDragItemId(null);
                        setDropItemId(null);
                        void persistItemOrder(ordered);
                      }}
                      onContextMenu={(e) => openItemMenu(e, item.id)}
                    >
                      <span
                        draggable
                        title="拖拽排序"
                        className="text-base-content/40 hover:text-base-content cursor-grab px-0.5 select-none active:cursor-grabbing"
                        onDragStart={(e) => {
                          setDragItemId(item.id);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onDragEnd={() => {
                          setDragItemId(null);
                          setDropItemId(null);
                        }}
                      >
                        ⋮⋮
                      </span>
                      <input
                        type="checkbox"
                        className="checkbox checkbox-sm"
                        checked={false}
                        onChange={() => void toggleComplete(item)}
                      />
                      <button
                        type="button"
                        className="min-w-0 flex-1 truncate text-left text-sm"
                        onClick={() => setEditingItem({ ...item })}
                      >
                        {item.title}
                      </button>
                      <span className={`text-xs ${priorityDot(item.priority)}`}>●</span>
                      {item.due_at ? (
                        <span className="text-base-content/50 text-xs">
                          {formatDue(item.due_at)}
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>

              {completedItems.length > 0 ? (
                <div className="mt-4 px-2">
                  <p className="text-base-content/50 mb-2 text-xs font-medium">已完成</p>
                  <ul className="space-y-1">
                    {completedItems.map((item) => (
                      <li
                        key={item.id}
                        className="hover:bg-base-200 flex items-center gap-2 rounded-lg px-2 py-2 opacity-70"
                        onContextMenu={(e) => openItemMenu(e, item.id)}
                      >
                        <input
                          type="checkbox"
                          className="checkbox checkbox-sm"
                          checked
                          onChange={() => void toggleComplete(item)}
                        />
                        <span className="flex-1 truncate text-sm line-through">{item.title}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>

            <div className="border-base-300 flex gap-2 border-t p-3">
              <input
                className="input input-bordered min-w-0 flex-1"
                placeholder="添加任务，Enter 确认"
                value={quickTitle}
                onChange={(e) => setQuickTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleQuickAdd();
                }}
              />
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void handleQuickAdd()}
              >
                添加
              </button>
            </div>
          </>
        ) : null}
      </main>

      {listMenu ? (
        <ContextMenu
          x={listMenu.x}
          y={listMenu.y}
          items={listMenuItems}
          onClose={() => setListMenu(null)}
        />
      ) : null}

      {itemMenu ? (
        <ContextMenu
          x={itemMenu.x}
          y={itemMenu.y}
          items={itemMenuItems}
          onClose={() => setItemMenu(null)}
        />
      ) : null}

      {editingItem ? (
        <dialog open className="modal modal-open">
          <div className="modal-box max-w-md">
            <FormFieldset legend="编辑任务" className="mt-4 gap-3">
              <div>
                <FormFieldLabel>标题</FormFieldLabel>
                <input
                  className="input input-bordered w-full"
                  value={editingItem.title}
                  onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
                />
              </div>
              <div>
                <FormFieldLabel>优先级</FormFieldLabel>
                <select
                  className="select select-bordered w-full"
                  value={editingItem.priority}
                  onChange={(e) =>
                    setEditingItem({
                      ...editingItem,
                      priority: e.target.value as TaskItemRow["priority"],
                    })
                  }
                >
                  <option value="none">无</option>
                  <option value="low">低</option>
                  <option value="medium">中</option>
                  <option value="high">高</option>
                </select>
              </div>
              <div>
                <FormFieldLabel>截止日期</FormFieldLabel>
                <input
                  type="datetime-local"
                  className="input input-bordered w-full"
                  value={
                    editingItem.due_at
                      ? new Date(editingItem.due_at).toISOString().slice(0, 16)
                      : ""
                  }
                  onChange={(e) =>
                    setEditingItem({
                      ...editingItem,
                      due_at: e.target.value ? new Date(e.target.value).toISOString() : null,
                    })
                  }
                />
              </div>
              <div>
                <FormFieldLabel>备注</FormFieldLabel>
                <textarea
                  className="textarea textarea-bordered w-full"
                  rows={3}
                  value={editingItem.note ?? ""}
                  onChange={(e) => setEditingItem({ ...editingItem, note: e.target.value || null })}
                />
              </div>
            </FormFieldset>
            <div className="modal-action">
              <button type="button" className="btn btn-ghost" onClick={() => setEditingItem(null)}>
                取消
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void saveEditingItem()}
              >
                保存
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button type="button" onClick={() => setEditingItem(null)}>
              close
            </button>
          </form>
        </dialog>
      ) : null}
    </div>
  );
}
