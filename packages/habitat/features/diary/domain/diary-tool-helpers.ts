import type { DiaryEntryRow } from "./types.ts";
import { entryDayKey, getDiaryEntryByDate, parseDiaryDate } from "./entry-store.ts";
import type { DiaryStoreContext } from "./types.ts";
import { findTagByTitle } from "@freeanima/features/tag/domain";
import { coerceString } from "@freeanima/shared/coerce-string";

export function entryPayload(row: DiaryEntryRow): DiaryEntryRow {
  return row;
}

export function parseTags(raw: unknown): string[] | undefined {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) return [];
  return raw.map((v) => String(v).trim()).filter(Boolean);
}

export function parseTagIds(raw: unknown): number[] | undefined {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) return [];
  const out: number[] = [];
  for (const v of raw) {
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isInteger(n) || n <= 0) continue;
    out.push(n);
  }
  return out;
}

/** 过滤用：字符串标签解析为已有 tag id；任一不存在则返回空数组（无匹配） */
export async function resolveFilterTagIds(
  worldId: number,
  opts: { tags?: string[]; tag_ids?: number[] },
): Promise<number[] | undefined> {
  const ids: number[] = [];
  const seen = new Set<number>();
  if (opts.tag_ids?.length) {
    for (const id of opts.tag_ids) {
      if (seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
  }
  if (opts.tags?.length) {
    for (const title of opts.tags) {
      const tag = await findTagByTitle(worldId, title);
      if (!tag) return [];
      if (seen.has(tag.id)) continue;
      seen.add(tag.id);
      ids.push(tag.id);
    }
  }
  return ids.length > 0 ? ids : undefined;
}

export function parseToolDate(raw: unknown): string {
  if (raw == null || coerceString(raw).trim() === "") return parseDiaryDate(null);
  return parseDiaryDate(coerceString(raw));
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
