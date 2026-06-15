import { formatCstDisplay, type FormatCstDisplayOpts } from "@freeanima/core/util";

const EMPTY = "—";

function toDisplay(value: unknown, opts?: FormatCstDisplayOpts): string {
  if (value == null || value === "") return EMPTY;
  if (value instanceof Date) {
    const formatted = formatCstDisplay(value, opts);
    return formatted || EMPTY;
  }
  if (typeof value === "number") {
    const formatted = formatCstDisplay(value, opts);
    return formatted || EMPTY;
  }
  if (typeof value === "string") {
    const formatted = formatCstDisplay(value, opts);
    return formatted || value || EMPTY;
  }
  return EMPTY;
}

/** CST `YYYY/MM/DD HH:MM` for WebUI timestamps */
export function formatDisplayDateTime(value: unknown, opts?: FormatCstDisplayOpts): string {
  return toDisplay(value, opts);
}

/** CST `YYYY/MM/DD` only */
export function formatDisplayDate(value: unknown): string {
  if (value == null || value === "") return EMPTY;
  if (typeof value === "string") {
    const trimmed = value.trim();
    const dayMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
    if (dayMatch) return `${dayMatch[1]}/${dayMatch[2]}/${dayMatch[3]}`;
  }
  const formatted = formatDisplayDateTime(value);
  if (formatted === EMPTY) return EMPTY;
  const space = formatted.indexOf(" ");
  return space > 0 ? formatted.slice(0, space) : formatted;
}

/** Session ID `YYYYMMDD_HHMMSS_…` → CST display when parseable */
export function formatSessionIdDateTime(sessionId: string, opts?: FormatCstDisplayOpts): string {
  const parts = sessionId.split("_");
  if (parts.length < 2 || parts[0]!.length < 8 || parts[1]!.length < 4) {
    return sessionId;
  }
  const y = parts[0]!.slice(0, 4);
  const mo = parts[0]!.slice(4, 6);
  const d = parts[0]!.slice(6, 8);
  const h = parts[1]!.slice(0, 2);
  const mi = parts[1]!.slice(2, 4);
  const datePart = `${y}/${mo}/${d}`;
  if (opts?.seconds && parts[1]!.length >= 6) {
    const s = parts[1]!.slice(4, 6);
    return `${datePart} ${h}:${mi}:${s}`;
  }
  return `${datePart} ${h}:${mi}`;
}
