import type { ActionSheetItem } from "@freeanima/ui-kit/composite";

import { OBJECTIVE_STATUS_LABEL, type ObjectiveRow, type ObjectiveStatus } from "./api.ts";

const STATUS_OPTIONS: ObjectiveStatus[] = [
  "not_started",
  "in_progress",
  "completed",
  "cancelled",
  "on_hold",
];

export function buildObjectiveMenuItems(
  row: ObjectiveRow,
  handlers: {
    onAddChild: (row: ObjectiveRow) => void;
    onStatusChange: (row: ObjectiveRow, status: ObjectiveStatus) => void;
  },
): ActionSheetItem[] {
  const statusItems: ActionSheetItem[] = STATUS_OPTIONS.filter((s) => s !== row.status).map(
    (status) => ({
      label: `设为${OBJECTIVE_STATUS_LABEL[status]}`,
      onClick: () => handlers.onStatusChange(row, status),
    }),
  );

  return [{ label: "添加子目标", onClick: () => handlers.onAddChild(row) }, ...statusItems];
}
