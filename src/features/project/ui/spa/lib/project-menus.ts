import { copyText } from "@freeanima/ui-kit/lib/copy-text.ts";

import type { TaskItemRow } from "./api.ts";

export type ProjectMenuItem = {
  label: string;
  danger?: boolean;
  onClick: () => void;
};

export function buildFolderMenuItems(
  folder: import("./api.ts").ProjectFolderRow,
  handlers: {
    onEdit: (folder: import("./api.ts").ProjectFolderRow) => void;
    onCreateChildFolder: (folder: import("./api.ts").ProjectFolderRow) => void;
    onDelete: (folder: import("./api.ts").ProjectFolderRow) => void;
  },
): ProjectMenuItem[] {
  return [
    { label: "编辑", onClick: () => handlers.onEdit(folder) },
    { label: "新建子文件夹", onClick: () => handlers.onCreateChildFolder(folder) },
    { label: "删除", danger: true, onClick: () => void handlers.onDelete(folder) },
  ];
}

export function buildProjectMenuItems(
  project: import("./api.ts").ProjectRow,
  handlers: {
    onEdit: (project: import("./api.ts").ProjectRow) => void;
    onDelete: (project: import("./api.ts").ProjectRow) => void;
    onStatusChange: (
      project: import("./api.ts").ProjectRow,
      status: import("./api.ts").ProjectRow["status"],
    ) => void;
    /** 当前是否隐藏已完成；用于切换文案 */
    hideCompleted: boolean;
    onToggleHideCompleted: () => void;
  },
): ProjectMenuItem[] {
  const statusItems: ProjectMenuItem[] =
    project.status === "active"
      ? [
          { label: "搁置", onClick: () => void handlers.onStatusChange(project, "on_hold") },
          { label: "完成", onClick: () => void handlers.onStatusChange(project, "completed") },
          { label: "取消", onClick: () => void handlers.onStatusChange(project, "cancelled") },
        ]
      : [
          {
            label: "重新激活",
            onClick: () => void handlers.onStatusChange(project, "active"),
          },
        ];

  return [
    { label: "编辑", onClick: () => handlers.onEdit(project) },
    { label: "复制 ID", onClick: () => void copyText(String(project.id)) },
    ...statusItems,
    {
      label: handlers.hideCompleted ? "显示已完成" : "隐藏已完成",
      onClick: handlers.onToggleHideCompleted,
    },
    { label: "删除项目", danger: true, onClick: () => void handlers.onDelete(project) },
  ];
}

export function buildProjectTaskMenuItems(
  item: TaskItemRow,
  handlers: {
    onEdit: () => void;
    onStartPomodoro?: () => void;
    onToggleComplete: () => void;
    onMoveToList: () => void;
    onMoveToProject: () => void;
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
    { label: "删除", danger: true, onClick: () => void handlers.onDelete() },
  );
  return items;
}
