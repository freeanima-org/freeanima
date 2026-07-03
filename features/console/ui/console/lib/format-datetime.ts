import {
  formatCstDisplay,
  type FormatCstDisplayOpts,
} from "@freeanima/console-contract/display-util";

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

/** CST `YYYY/MM/DD HH:MM` for Console timestamps */
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

/** Conversation ID `YYYYMMDD_HHMMSS_…` → CST display when parseable */
export function formatConversationIdDateTime(
  conversationId: string,
  opts?: FormatCstDisplayOpts,
): string {
  const parts = conversationId.split("_");
  const dateSegment = parts[0];
  const timeSegment = parts[1];
  if (
    parts.length < 2 ||
    dateSegment === undefined ||
    timeSegment === undefined ||
    dateSegment.length < 8 ||
    timeSegment.length < 4
  ) {
    return conversationId;
  }
  const y = dateSegment.slice(0, 4);
  const mo = dateSegment.slice(4, 6);
  const d = dateSegment.slice(6, 8);
  const h = timeSegment.slice(0, 2);
  const mi = timeSegment.slice(2, 4);
  const datePart = `${y}/${mo}/${d}`;
  if (opts?.seconds && timeSegment.length >= 6) {
    const s = timeSegment.slice(4, 6);
    return `${datePart} ${h}:${mi}:${s}`;
  }
  return `${datePart} ${h}:${mi}`;
}
