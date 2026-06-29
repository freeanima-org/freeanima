import type { TaskMenuItem } from "./menu-types.ts";
import type { TaskItemRow, TaskListRow } from "./api.ts";

export function buildListMenuItems(
  list: TaskListRow,
  handlers: {
    onRename: (list: TaskListRow) => void;
    onClose: (list: TaskListRow) => void;
    onReopen: (list: TaskListRow) => void;
    onDelete: (list: TaskListRow) => void;
  },
): TaskMenuItem[] {
  const items: TaskMenuItem[] = [{ label: "重命名", onClick: () => handlers.onRename(list) }];
  if (list.closed) {
    items.push({ label: "取消归档", onClick: () => void handlers.onReopen(list) });
    if (!list.is_default) {
      items.push({ label: "删除", danger: true, onClick: () => void handlers.onDelete(list) });
    }
  } else if (!list.is_default) {
    items.push({ label: "归档", onClick: () => void handlers.onClose(list) });
    items.push({ label: "删除", danger: true, onClick: () => void handlers.onDelete(list) });
  }
  return items;
}

export function buildItemMenuItems(
  item: TaskItemRow,
  handlers: {
    onEdit: (item: TaskItemRow) => void;
    onToggleComplete: (item: TaskItemRow) => void;
    onMoveTo: (item: TaskItemRow) => void;
    onDelete: (item: TaskItemRow) => void;
  },
): TaskMenuItem[] {
  return [
    { label: "编辑", onClick: () => handlers.onEdit(item) },
    {
      label: item.status === "completed" ? "标记未完成" : "标记完成",
      onClick: () => void handlers.onToggleComplete(item),
    },
    { label: "移动到…", onClick: () => handlers.onMoveTo(item) },
    { label: "删除", danger: true, onClick: () => void handlers.onDelete(item) },
  ];
}
