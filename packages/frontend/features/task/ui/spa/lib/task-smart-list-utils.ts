import type { SmartListRow } from "./api.ts";

export type TaskModuleSelection =
  | { kind: "smart_list"; key: string }
  | { kind: "list"; id: number }
  | { kind: "search" };

export function smartListRowKey(row: Pick<SmartListRow, "id" | "preset">): string {
  if (row.preset) return row.preset;
  if (row.id != null) return `id:${row.id}`;
  return "";
}

export function findSmartListRowByKey(rows: SmartListRow[], key: string): SmartListRow | undefined {
  return rows.find((row) => smartListRowKey(row) === key);
}

/** 完成类智能清单：不显示 pending/completed 双分区 */
export function isCompletedOnlyFilters(filters: { status?: string | undefined }): boolean {
  return filters.status === "completed";
}

/** 是否允许在智能清单模式下快速添加（写入收件箱） */
export function allowsSmartListQuickAdd(filters: { status?: string | undefined }): boolean {
  return filters.status !== "completed";
}
