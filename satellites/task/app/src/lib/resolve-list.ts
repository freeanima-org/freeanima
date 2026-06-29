import type { TaskListRow } from "./api.ts";

/** 默认清单（is_default），否则第一条非文件夹清单 */
export function resolveDefaultListId(rows: TaskListRow[]): number | null {
  if (rows.length === 0) return null;
  const pick =
    rows.find((l) => l.is_default && !l.is_folder) ?? rows.find((l) => !l.is_folder) ?? rows[0];
  return pick?.id ?? null;
}

/** 解析应选中的清单：当前有效则保留；Web 下 URL 有效则用 URL；否则默认清单 */
export function resolveSelectedListIdWithUrl(
  rows: TaskListRow[],
  options: { webShell: boolean; currentId: number | null; urlListId: number | null },
): number | null {
  if (rows.length === 0) return null;

  if (options.currentId != null) {
    const current = rows.find((l) => l.id === options.currentId);
    if (current && !current.is_folder) return options.currentId;
  }

  if (options.webShell && options.urlListId != null) {
    const fromUrl = rows.find((l) => l.id === options.urlListId);
    if (fromUrl && !fromUrl.is_folder) return options.urlListId;
  }

  return resolveDefaultListId(rows);
}
