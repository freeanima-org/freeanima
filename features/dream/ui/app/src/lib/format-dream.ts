export function formatDreamDay(value: string): string {
  const day = value.trim().slice(0, 10);
  const date = new Date(`${day}T12:00:00+08:00`);
  if (Number.isNaN(date.getTime())) return day;
  return date.toLocaleDateString("zh-CN");
}

export function formatDreamDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN");
}
