import { copyText } from "@freeanima/frontend/ui-kit/lib/copy-text.ts";

import type { TaskItemRow } from "./api.ts";

export type ProjectMenuItem = {
  label: string;
  danger?: boolean;
  onClick: () => void;
};

export function buildFolderMenuItems(
  folder: import("./api.ts").ProjectFolderRow,
  handlers: {
    onRename: (folder: import("./api.ts").ProjectFolderRow) => void;
    onCreateChildFolder: (folder: import("./api.ts").ProjectFolderRow) => void;
    onDelete: (folder: import("./api.ts").ProjectFolderRow) => void;
  },
): ProjectMenuItem[] {
  return [
    { label: "重命名", onClick: () => handlers.onRename(folder) },
    { label: "新建子文件夹", onClick: () => handlers.onCreateChildFolder(folder) },
    { label: "删除", danger: true, onClick: () => void handlers.onDelete(folder) },
  ];
}

export function buildProjectMenuItems(
  project: import("./api.ts").ProjectRow,
  handlers: {
    onDelete: (project: import("./api.ts").ProjectRow) => void;
  },
): ProjectMenuItem[] {
  return [{ label: "删除项目", danger: true, onClick: () => void handlers.onDelete(project) }];
}

export function buildProjectTaskMenuItems(
  item: TaskItemRow,
  handlers: {
    onEdit: () => void;
    onStartPomodoro?: () => void;
    onToggleComplete: () => void;
    onMoveToList: () => void;
    onMoveToProject: () => void;
    onMoveToBacklog: () => void;
    onDelete: () => void;
  },
): ProjectMenuItem[] {
  const items: ProjectMenuItem[] = [
    { label: "编辑", onClick: handlers.onEdit },
    { label: "复制 ID", onClick: () => void copyText(String(item.id)) },
  ];
  if (item.status === "pending" && handlers.onStartPomodoro) {
    items.push({ label: "开始番茄", onClick: handlers.onStartPomodoro });
  }
  items.push(
    {
      label: item.status === "completed" ? "标记未完成" : "标记完成",
      onClick: () => void handlers.onToggleComplete(),
    },
    { label: "移动到清单", onClick: handlers.onMoveToList },
    { label: "移动到项目", onClick: handlers.onMoveToProject },
    { label: "移回清单", onClick: () => void handlers.onMoveToBacklog() },
    { label: "删除", danger: true, onClick: () => void handlers.onDelete() },
  );
  return items;
}
