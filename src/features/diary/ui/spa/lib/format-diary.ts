export type DiarySubjectKind = "user" | "agent";

export type DiaryTextBlock = {
  id: number;
  title: string;
  content: string;
  sort_order: number;
  parent_id: number;
  client_op_id: string | null;
  components: string[];
  tag_ids: number[];
  created_at: string;
  updated_at: string;
};

export type DiaryEntryRow = {
  id: number;
  title: string;
  summary: string;
  entry_at: string;
  tags: string[];
  /** list/search 侧常为空；编辑前由 get 填充 */
  blocks: DiaryTextBlock[];
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

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function isoToDateLocalValue(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
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
