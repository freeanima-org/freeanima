/** Millisecond offset of CST (+8) from UTC */
const CST_OFFSET_MS = 8 * 60 * 60 * 1000;

/** Current instant as CST ISO 8601 string (+08:00) */
function formatCstIso(date: Date = new Date()): string {
  return new Date(date.getTime() + CST_OFFSET_MS).toISOString().replace("Z", "+08:00");
}

export type FormatCstDisplayOpts = {
  /** Include seconds (default: minute precision only) */
  seconds?: boolean;
};

const CST_ISO_PARTS_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/;

function formatCstIsoParts(iso: string, opts?: FormatCstDisplayOpts): string {
  const match = CST_ISO_PARTS_RE.exec(iso);
  if (!match) return "";
  const [, y, mo, d, h, mi, s] = match;
  const datePart = `${y}/${mo}/${d}`;
  if (opts?.seconds) return `${datePart} ${h}:${mi}:${s ?? "00"}`;
  return `${datePart} ${h}:${mi}`;
}

function parseToDate(input: string | Date | number): Date | null {
  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? null : input;
  }
  if (typeof input === "number") {
    if (!Number.isFinite(input) || input <= 0) return null;
    const ms = input > 1e12 ? input : input * 1000;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const trimmed = input.trim();
  if (!trimmed) return null;
  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Human-readable CST display: `YYYY/MM/DD HH:MM` or with seconds */
export function formatCstDisplay(
  input: string | Date | number | null | undefined,
  opts?: FormatCstDisplayOpts,
): string {
  if (input == null || input === "") return "";
  const date = parseToDate(input);
  if (!date) return typeof input === "string" ? input : "";
  return formatCstIsoParts(formatCstIso(date), opts);
}
