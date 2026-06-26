import type { TaskMenuItem } from "./menu-types.ts";
import type { TaskItemRow, TaskListRow } from "./api.ts";

export function buildListMenuItems(
  list: TaskListRow,
  handlers: {
    onRename: (list: TaskListRow) => void;
    onDelete: (list: TaskListRow) => void;
  },
): TaskMenuItem[] {
  return [
    { label: "重命名", onClick: () => handlers.onRename(list) },
    { label: "删除", danger: true, onClick: () => void handlers.onDelete(list) },
  ];
}

export function buildItemMenuItems(
  item: TaskItemRow,
  handlers: {
    onEdit: (item: TaskItemRow) => void;
    onToggleComplete: (item: TaskItemRow) => void;
    onDelete: (item: TaskItemRow) => void;
  },
): TaskMenuItem[] {
  return [
    { label: "编辑", onClick: () => handlers.onEdit(item) },
    {
      label: item.status === "completed" ? "标记未完成" : "标记完成",
      onClick: () => void handlers.onToggleComplete(item),
    },
    { label: "删除", danger: true, onClick: () => void handlers.onDelete(item) },
  ];
}
