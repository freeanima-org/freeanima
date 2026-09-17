import { isRecord } from "@freeanima/shared/util";

export type ColumnSplits = {
  list?: number;
  middle?: number;
};

export type ColumnSplitDefaults = {
  list: number;
  middle?: number;
};

export type ColumnSplitLimits = {
  list: { min: number; max: number };
  middle: { min: number; max: number };
};

export const DEFAULT_COLUMN_SPLIT_LIMITS: ColumnSplitLimits = {
  list: { min: 180, max: 480 },
  middle: { min: 220, max: 640 },
};

const STORAGE_PREFIX = "freeanima:column-splits:";

export function clampColumnWidth(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function readColumnSplits(key: string): ColumnSplits | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    const splits: ColumnSplits = {};
    if (typeof parsed.list === "number") splits.list = parsed.list;
    if (typeof parsed.middle === "number") splits.middle = parsed.middle;
    if (splits.list === undefined && splits.middle === undefined) return null;
    return splits;
  } catch {
    return null;
  }
}

export function writeColumnSplits(key: string, splits: ColumnSplits): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(splits));
}

export function resolveColumnSplits(
  key: string,
  defaults: ColumnSplitDefaults,
  limits: ColumnSplitLimits = DEFAULT_COLUMN_SPLIT_LIMITS,
): ColumnSplits {
  const stored = readColumnSplits(key);
  const list = clampColumnWidth(stored?.list ?? defaults.list, limits.list.min, limits.list.max);
  const result: ColumnSplits = { list };
  if (defaults.middle != null) {
    result.middle = clampColumnWidth(
      stored?.middle ?? defaults.middle,
      limits.middle.min,
      limits.middle.max,
    );
  }
  return result;
}

export function adjustColumnSplit(
  current: ColumnSplits,
  column: "list" | "middle",
  delta: number,
  defaults: ColumnSplitDefaults,
  limits: ColumnSplitLimits = DEFAULT_COLUMN_SPLIT_LIMITS,
): ColumnSplits {
  const resolved = resolveColumnSplits("", defaults, limits);
  const list = current.list ?? resolved.list ?? defaults.list;
  const middle = current.middle ?? resolved.middle;
  if (column === "list") {
    const next: ColumnSplits = {
      list: clampColumnWidth(list + delta, limits.list.min, limits.list.max),
    };
    if (middle != null) next.middle = middle;
    return next;
  }
  if (middle == null) return { list };
  return {
    list,
    middle: clampColumnWidth(middle + delta, limits.middle.min, limits.middle.max),
  };
}
