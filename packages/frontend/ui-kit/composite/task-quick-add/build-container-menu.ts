import type { TaskListRowLike } from "../../lib/task-list-tree.ts";
import type { ProjectPickerRow } from "../MoveToProjectPicker.tsx";

export type ContainerMenuEntry = {
  key: string;
  kind: "list" | "project";
  id: number;
  label: string;
  section: "清单" | "项目";
};

export function buildContainerMenuEntries(
  query: string,
  lists: TaskListRowLike[],
  projects: ProjectPickerRow[],
): ContainerMenuEntry[] {
  const q = query.trim().toLowerCase();
  const listRows = lists
    .filter((l) => !l.is_folder && !l.closed)
    .filter((l) => !q || l.name.toLowerCase().includes(q))
    .map((l): ContainerMenuEntry => ({
      key: `list:${l.id}`,
      kind: "list",
      id: l.id,
      label: l.name,
      section: "清单",
    }));

  const projectRows = projects
    .filter((p) => p.status === "active" || p.status === "on_hold")
    .filter((p) => !q || p.title.toLowerCase().includes(q))
    .map((p): ContainerMenuEntry => ({
      key: `project:${p.id}`,
      kind: "project",
      id: p.id,
      label: p.title,
      section: "项目",
    }));

  return [...listRows, ...projectRows];
}
