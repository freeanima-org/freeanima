const LIST_PREFIX = "list:";
const TASK_PREFIX = "task:";

/** 侧栏「清单」区根级 drop 目标：松手于此 → parent_id: null */
export const LIST_ROOT_DND_ID = "list-root";

export function listDndId(id: number): string {
  return `${LIST_PREFIX}${id}`;
}

export function taskDndId(id: number): string {
  return `${TASK_PREFIX}${id}`;
}

export function isListRootDndId(id: string | number): boolean {
  return String(id) === LIST_ROOT_DND_ID;
}

export function isListDndId(id: string | number): boolean {
  return parseListDndId(id) != null;
}

export function isTaskDndId(id: string | number): boolean {
  return String(id).startsWith(TASK_PREFIX);
}

export function parseListDndId(id: string | number): number | null {
  const raw = String(id);
  if (!raw.startsWith(LIST_PREFIX)) return null;
  const n = Number(raw.slice(LIST_PREFIX.length));
  return Number.isFinite(n) ? n : null;
}

export function parseTaskDndId(id: string | number): number | null {
  const raw = String(id);
  if (!raw.startsWith(TASK_PREFIX)) return null;
  const n = Number(raw.slice(TASK_PREFIX.length));
  return Number.isFinite(n) ? n : null;
}
