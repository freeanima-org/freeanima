import type { DiaryEntryRow } from "./types.ts";
import { entryDayKey, getDiaryEntryByDate, parseDiaryDate } from "./entry-store.ts";
import type { DiaryStoreContext } from "./types.ts";

export function entryPayload(row: DiaryEntryRow): DiaryEntryRow {
  return row;
}

export function parseTags(raw: unknown): string[] | undefined {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) return [];
  return raw.map((v) => String(v).trim()).filter(Boolean);
}

export function parseToolDate(raw: unknown): string {
  if (raw == null || String(raw).trim() === "") return parseDiaryDate(null);
  return parseDiaryDate(String(raw));
}

export function toolDateKey(raw: unknown): string {
  return entryDayKey(parseToolDate(raw));
}

export async function requireEntryByDate(
  ctx: DiaryStoreContext,
  rawDate: unknown,
): Promise<{ entry: DiaryEntryRow; dateKey: string } | { error: string }> {
  const dateKey = toolDateKey(rawDate);
  const entry = await getDiaryEntryByDate(ctx, dateKey);
  if (!entry) {
    return { error: `diary entry not found for date ${dateKey}` };
  }
  return { entry, dateKey };
}
