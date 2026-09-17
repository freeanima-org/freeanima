import type { TaskItemPriority } from "../../lib/task-item-display.ts";
import type { TaskListRowLike } from "../../lib/task-list-tree.ts";
import type { ProjectPickerRow } from "../MoveToProjectPicker.tsx";

export type QuickAddContainer =
  | { kind: "list"; id: number; label: string }
  | { kind: "project"; id: number; label: string };

export type QuickAddMeta = {
  container: QuickAddContainer | null;
  tagIds: number[];
  tagTitleById: Map<number, string>;
  priority: TaskItemPriority | null;
  startAt: string | null;
};

export type QuickAddTagOption = {
  id: number;
  title: string;
};

export type QuickAddSubmitPayload = {
  title: string;
  container: QuickAddContainer | null;
  tagIds: number[];
  priority: TaskItemPriority;
  startAt: string | null;
};

export type TaskQuickAddComposerProps = {
  lists: TaskListRowLike[];
  projects: ProjectPickerRow[];
  defaultContainer: QuickAddContainer | null;
  /** 固定计划日 YYYY-MM-DD（日历议程） */
  fixedStartDay?: string | null;
  searchTags: (query: string) => Promise<QuickAddTagOption[]>;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  submitLabel?: string;
  enterToSubmit?: boolean;
  /** 隐藏 @ 容器选择（仍可用 defaultContainer） */
  hideContainerPicker?: boolean;
  onSubmit: (payload: QuickAddSubmitPayload) => void | Promise<void>;
};

export function emptyQuickAddMeta(defaultContainer: QuickAddContainer | null): QuickAddMeta {
  return {
    container: defaultContainer,
    tagIds: [],
    tagTitleById: new Map(),
    priority: null,
    startAt: null,
  };
}
