import type { TaskListRow } from "./api.ts";

/** 默认清单（is_default），否则第一条 */
export function resolveDefaultListId(rows: TaskListRow[]): number | null {
  if (rows.length === 0) return null;
  return (rows.find((l) => l.is_default) ?? rows[0])!.id;
}

/** 解析应选中的清单：当前有效则保留；Web 下 URL 有效则用 URL；否则默认清单 */
export function resolveSelectedListIdWithUrl(
  rows: TaskListRow[],
  options: { webShell: boolean; currentId: number | null; urlListId: number | null },
): number | null {
  if (rows.length === 0) return null;

  if (options.currentId != null && rows.some((l) => l.id === options.currentId)) {
    return options.currentId;
  }

  if (
    options.webShell &&
    options.urlListId != null &&
    rows.some((l) => l.id === options.urlListId)
  ) {
    return options.urlListId;
  }

  return resolveDefaultListId(rows);
}
