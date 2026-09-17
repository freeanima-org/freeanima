import { findTagByTitle } from "@freeanima/features/tag/domain";

import type { NoteRow } from "./types.ts";

export function notePayload(row: NoteRow): NoteRow {
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

export function parsePositiveInt(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
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

export function requireId(raw: unknown, field = "id"): number | string {
  const id = parsePositiveInt(raw);
  if (id == null) return `invalid ${field}`;
  return id;
}
