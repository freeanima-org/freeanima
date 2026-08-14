import type { TaskListRow } from "./api.ts";

/** 默认清单（is_default），否则第一条非文件夹清单 */
export function resolveDefaultListId(rows: TaskListRow[]): number | null {
  if (rows.length === 0) return null;
  const pick =
    rows.find((l) => l.is_default && !l.is_folder) ?? rows.find((l) => !l.is_folder) ?? rows[0];
  return pick?.id ?? null;
}

function isSelectableList(row: TaskListRow | undefined): row is TaskListRow {
  return Boolean(row && !row.is_folder);
}

/** 解析应选中的清单：当前 → storage → URL → 默认 */
export function resolveSelectedListId(
  rows: TaskListRow[],
  options: {
    currentId: number | null;
    storedListId: number | null;
    urlListId: number | null;
    preferUrl: boolean;
  },
): number | null {
  if (rows.length === 0) return null;

  if (options.currentId != null) {
    const current = rows.find((l) => l.id === options.currentId);
    if (isSelectableList(current)) return options.currentId;
  }

  if (options.storedListId != null) {
    const stored = rows.find((l) => l.id === options.storedListId);
    if (isSelectableList(stored)) return options.storedListId;
  }

  if (options.preferUrl && options.urlListId != null) {
    const fromUrl = rows.find((l) => l.id === options.urlListId);
    if (isSelectableList(fromUrl)) return options.urlListId;
  }

  return resolveDefaultListId(rows);
}
