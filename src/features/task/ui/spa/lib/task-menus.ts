import type { TaskListRow } from "./api.ts";
import { copyText } from "./copy-text.ts";

function copyIdMenuItem(id: number): import("./menu-types.ts").TaskMenuItem {
  return {
    label: "复制 ID",
    onClick: () => void copyText(String(id)),
  };
}

export function buildSmartListMenuItems(
  row: import("./api.ts").SmartListRow,
  handlers: {
    onEdit: (row: import("./api.ts").SmartListRow) => void;
    onDelete: (row: import("./api.ts").SmartListRow) => void;
  },
): import("./menu-types.ts").TaskMenuItem[] {
  return [
    { label: "编辑", onClick: () => handlers.onEdit(row) },
    { label: "删除", danger: true, onClick: () => void handlers.onDelete(row) },
  ];
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
  if (list.closed && !list.is_folder) {
    const items: import("./menu-types.ts").TaskMenuItem[] = [
      { label: "取消归档", onClick: () => void handlers.onReopen(list) },
      copyIdMenuItem(list.id),
    ];
    if (!list.is_default) {
      items.push({ label: "删除", danger: true, onClick: () => void handlers.onDelete(list) });
    }
    return items;
  }

  const items: import("./menu-types.ts").TaskMenuItem[] = [
    { label: "编辑", onClick: () => handlers.onRename(list) },
    copyIdMenuItem(list.id),
  ];

  if (list.is_folder) {
    const onCreateChildList = handlers.onCreateChildList;
    const onCreateChildFolder = handlers.onCreateChildFolder;
    if (onCreateChildList) {
      items.push({ label: "新建子清单", onClick: () => onCreateChildList(list) });
    }
    if (onCreateChildFolder) {
      items.push({ label: "新建子文件夹", onClick: () => onCreateChildFolder(list) });
    }
    if (!list.is_default) {
      items.push({ label: "删除", danger: true, onClick: () => void handlers.onDelete(list) });
    }
    return items;
  }

  if (!list.is_default) {
    items.push({ label: "归档", onClick: () => void handlers.onClose(list) });
    items.push({ label: "删除", danger: true, onClick: () => void handlers.onDelete(list) });
  }
  return items;
}

export function buildItemMenuItems(
  item: import("./api.ts").TaskItemRow,
  handlers: {
    onEdit: (item: import("./api.ts").TaskItemRow) => void;
    onStartPomodoro?: (item: import("./api.ts").TaskItemRow) => void;
    onToggleComplete: (item: import("./api.ts").TaskItemRow) => void;
    onMoveTo: (item: import("./api.ts").TaskItemRow) => void;
    onMoveToProject?: (item: import("./api.ts").TaskItemRow) => void;
    onDelete: (item: import("./api.ts").TaskItemRow) => void;
  },
  opts?: { listArchived?: boolean },
): import("./menu-types.ts").TaskMenuItem[] {
  if (opts?.listArchived) {
    return [copyIdMenuItem(item.id)];
  }
  const items: import("./menu-types.ts").TaskMenuItem[] = [
    { label: "编辑", onClick: () => handlers.onEdit(item) },
    copyIdMenuItem(item.id),
  ];
  if (item.status === "pending" && handlers.onStartPomodoro) {
    items.push({ label: "开始番茄", onClick: () => handlers.onStartPomodoro?.(item) });
  }
  items.push(
    {
      label: item.status === "completed" ? "标记未完成" : "标记完成",
      onClick: () => void handlers.onToggleComplete(item),
    },
    { label: "移动到…", onClick: () => handlers.onMoveTo(item) },
  );
  if (item.project_id == null && handlers.onMoveToProject) {
    items.push({ label: "移入项目…", onClick: () => handlers.onMoveToProject?.(item) });
  }
  items.push({ label: "删除", danger: true, onClick: () => void handlers.onDelete(item) });
  return items;
}
