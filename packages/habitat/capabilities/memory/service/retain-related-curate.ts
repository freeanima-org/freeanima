/**
 * retain 本对话相关策展：近期 3 ∪ 今日会话内语义相关 ≤5 → merge 去重 → 时间倒序取 5。
 * 用于防重复的轻对照，非整表整理。
 */

import { logCapability as logComponent } from "@freeanima/habitat/core/config/capability-injection";
import type { SemanticMemoryRow } from "@freeanima/habitat/core/db/schema/rows";
import { listSemanticMemoryBySourceSessions } from "@freeanima/habitat/core/db/pg/semantic-memory";

import { cstDayRange } from "../day-window/build-messages.ts";
import { todayCstDay } from "../sleep-catch-up.ts";
import { collectRetainPassiveHits, type RetainTextItem } from "./retain-passive-recall.ts";

/** 本会话按 updated_at 倒序取近期条数 */
export const RETAIN_RELATED_RECENT_LIMIT = 3;
/** 今日会话内 hybrid 命中上限（合并前） */
export const RETAIN_RELATED_TODAY_SEMANTIC_LIMIT = 5;
/** 注入 related_memories 最终上限 */
export const RETAIN_RELATED_RESULT_LIMIT = 5;

/** 今日会话内语义相关：略低于 Working 默认 */
export const RETAIN_RELATED_TODAY_MIN_SCORE = 0.012;
export const RETAIN_RELATED_TODAY_MIN_RELATIVE_SCORE = 0.45;

/** 跨会话语义相关（retain passive）：高于 Working 默认 */
export const RETAIN_PASSIVE_MIN_SCORE = 0.032;
export const RETAIN_PASSIVE_MIN_RELATIVE_SCORE = 0.7;

export function memorySortTimeMs(row: {
  updated_at?: Date | string | null;
  observed_at?: Date | string | null;
}): number {
  const raw = row.updated_at ?? row.observed_at;
  if (raw instanceof Date) return raw.getTime();
  if (typeof raw === "string" && raw.trim()) {
    const t = Date.parse(raw);
    return Number.isFinite(t) ? t : 0;
  }
  return 0;
}

/** 时刻是否落在 CST 日窗 [fromIso, toIso) */
export function isTimestampInCstDayRange(
  raw: Date | string | null | undefined,
  range: { fromIso: string; toIso: string },
): boolean {
  if (raw == null) return false;
  const ms = raw instanceof Date ? raw.getTime() : Date.parse(raw);
  if (!Number.isFinite(ms)) return false;
  const from = Date.parse(range.fromIso);
  const to = Date.parse(range.toIso);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return false;
  return ms >= from && ms < to;
}

/** 记忆在 CST 当日是否有更新或 observed */
export function isMemoryActiveOnCstDay(
  row: {
    updated_at?: Date | string | null;
    observed_at?: Date | string | null;
  },
  range: { fromIso: string; toIso: string },
): boolean {
  return (
    isTimestampInCstDayRange(row.updated_at, range) ||
    isTimestampInCstDayRange(row.observed_at, range)
  );
}

/**
 * 两桶合并去重后按时间倒序截断。
 * 稀疏场景允许 3+1 / 2+1 等，不强行凑满。
 */
export function mergeRetainRelatedCurated(opts: {
  recent: readonly SemanticMemoryRow[];
  todaySemantic: readonly SemanticMemoryRow[];
  maxResult?: number;
}): SemanticMemoryRow[] {
  const maxResult = opts.maxResult ?? RETAIN_RELATED_RESULT_LIMIT;
  const byId = new Map<number, SemanticMemoryRow>();
  for (const row of opts.recent) byId.set(row.id, row);
  for (const row of opts.todaySemantic) {
    if (!byId.has(row.id)) byId.set(row.id, row);
  }
  return [...byId.values()]
    .toSorted((a, b) => memorySortTimeMs(b) - memorySortTimeMs(a))
    .slice(0, Math.max(0, maxResult));
}

export type CurateRetainRelatedResult = {
  rows: SemanticMemoryRow[];
  /** 本会话库内 active 总数（调试/统计用） */
  session_total: number;
};

/** 拉取并策展本对话 related_memories */
export async function curateRetainRelatedMemories(opts: {
  conversation_id: string;
  text_items: readonly RetainTextItem[];
  now_ms?: number;
  world_id?: number;
}): Promise<CurateRetainRelatedResult> {
  const conversationId = opts.conversation_id.trim();
  const sessionRows = conversationId
    ? await listSemanticMemoryBySourceSessions([conversationId])
    : [];
  const recent = sessionRows.slice(0, RETAIN_RELATED_RECENT_LIMIT);
  const byId = new Map(sessionRows.map((r) => [r.id, r]));

  const day = todayCstDay(opts.now_ms ?? Date.now());
  const range = cstDayRange(day);

  let todaySemantic: SemanticMemoryRow[] = [];
  if (conversationId && opts.text_items.length > 0) {
    try {
      const hits = await collectRetainPassiveHits(opts.text_items, new Set(), {
        enabled: true,
        limit: RETAIN_RELATED_TODAY_SEMANTIC_LIMIT,
        min_score: RETAIN_RELATED_TODAY_MIN_SCORE,
        min_relative_score: RETAIN_RELATED_TODAY_MIN_RELATIVE_SCORE,
        ...(opts.world_id != null ? { world_id: opts.world_id } : {}),
      });
      const picked: SemanticMemoryRow[] = [];
      for (const hit of hits) {
        if (!hit.source_conversations.includes(conversationId)) continue;
        const row = byId.get(hit.semantic_memory_id);
        if (!row) continue;
        if (!isMemoryActiveOnCstDay(row, range)) continue;
        picked.push(row);
        if (picked.length >= RETAIN_RELATED_TODAY_SEMANTIC_LIMIT) break;
      }
      todaySemantic = picked;
    } catch (e) {
      // 与跨会话 passive 一致：hybrid 失败时仍保留 recent，不中断 retain
      logComponent("memory").warn("retain related today-semantic failed", {
        conversation_id: conversationId,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return {
    rows: mergeRetainRelatedCurated({ recent, todaySemantic }),
    session_total: sessionRows.length,
  };
}
