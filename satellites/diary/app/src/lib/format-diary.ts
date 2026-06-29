export type DiarySubjectKind = "user" | "agent";

export type DiaryEntryRow = {
  id: number;
  title: string;
  summary: string;
  content: string;
  entry_at: string;
  tags: string[];
  created_at: string;
  updated_at: string;
};

/** 列表/顶栏：仅显示日期 */
export function formatEntryDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return date.toLocaleDateString();
}

/** 按日唯一键（YYYY-MM-DD，与 entry_at 存储对齐） */
export function entryDayKey(iso: string): string {
  return iso.trim().slice(0, 10);
}

export function entryDateKey(value: string): string {
  return entryDayKey(value);
}

export function isoToDateLocalValue(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** 日记条目按「日」存储；固定 CST 正午避免时区跨日 */
export function dateLocalToEntryAtIso(dateLocal: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateLocal.trim());
  if (!match) return dateLocalToEntryAtIso(defaultEntryDateLocal());
  const [, y, m, d] = match;
  return `${y}-${m}-${d}T12:00:00+08:00`;
}

export function defaultEntryDateLocal(): string {
  return isoToDateLocalValue(new Date().toISOString());
}

/** entity.title 与日期对齐，供搜索与兼容旧数据 */
export function titleFromDateLocal(dateLocal: string): string {
  return formatEntryDate(dateLocalToEntryAtIso(dateLocal));
}
