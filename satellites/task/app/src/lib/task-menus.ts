import type { TaskListRow } from "./api.ts";
import { copyText } from "./copy-text.ts";

function copyIdMenuItem(id: number): import("./menu-types.ts").TaskMenuItem {
  return {
    label: "复制 ID",
    onClick: () => void copyText(String(id)),
  };
}

export function buildListMenuItems(
  list: TaskListRow,
  handlers: {
    onRename: (list: TaskListRow) => void;
    onClose: (list: TaskListRow) => void;
    onReopen: (list: TaskListRow) => void;
    onDelete: (list: TaskListRow) => void;
    onCreateChildFolder?: (folder: TaskListRow) => void;
    onCreateChildList?: (folder: TaskListRow) => void;
  },
): import("./menu-types.ts").TaskMenuItem[] {
  const items: import("./menu-types.ts").TaskMenuItem[] = [
    { label: "重命名", onClick: () => handlers.onRename(list) },
    copyIdMenuItem(list.id),
  ];

  if (list.is_folder) {
    if (handlers.onCreateChildList) {
      items.push({ label: "新建子清单", onClick: () => handlers.onCreateChildList!(list) });
    }
    if (handlers.onCreateChildFolder) {
      items.push({ label: "新建子文件夹", onClick: () => handlers.onCreateChildFolder!(list) });
    }
  }

  if (list.closed) {
    items.push({ label: "取消归档", onClick: () => void handlers.onReopen(list) });
    if (!list.is_default) {
      items.push({
        label: "删除",
        danger: true,
        onClick: () => void handlers.onDelete(list),
      });
    }
  } else if (!list.is_default) {
    items.push({ label: "归档", onClick: () => void handlers.onClose(list) });
    items.push({ label: "删除", danger: true, onClick: () => void handlers.onDelete(list) });
  }
  return items;
}

export function buildItemMenuItems(
  item: import("./api.ts").TaskItemRow,
  handlers: {
    onEdit: (item: import("./api.ts").TaskItemRow) => void;
    onToggleComplete: (item: import("./api.ts").TaskItemRow) => void;
    onMoveTo: (item: import("./api.ts").TaskItemRow) => void;
    onDelete: (item: import("./api.ts").TaskItemRow) => void;
  },
): import("./menu-types.ts").TaskMenuItem[] {
  return [
    { label: "编辑", onClick: () => handlers.onEdit(item) },
    copyIdMenuItem(item.id),
    {
      label: item.status === "completed" ? "标记未完成" : "标记完成",
      onClick: () => void handlers.onToggleComplete(item),
    },
    { label: "移动到…", onClick: () => handlers.onMoveTo(item) },
    { label: "删除", danger: true, onClick: () => void handlers.onDelete(item) },
  ];
}
