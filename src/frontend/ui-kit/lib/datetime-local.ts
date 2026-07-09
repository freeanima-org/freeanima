function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function isoToDateLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function isoToTimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function mergeDateTimeLocal(datePart: string, timePart: string): string | null {
  if (!datePart) return null;
  const time = timePart || "00:00";
  const d = new Date(`${datePart}T${time}:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function dateLocalToIso(datePart: string): string | null {
  return mergeDateTimeLocal(datePart, "00:00");
}

export function todayDateLocalValue(): string {
  return isoToDateLocalValue(new Date().toISOString());
}

export function formatDue(due: string | null): string {
  if (!due) return "";
  const d = new Date(due);
  if (Number.isNaN(d.getTime())) return due;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
