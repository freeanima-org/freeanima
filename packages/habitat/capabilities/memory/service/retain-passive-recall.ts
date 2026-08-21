/**
 * retain 语义相关：按 user/assistant 各条正文分别 hybrid 召回，两侧分配额后合并去重。
 */

import { isFtsQueryError } from "@freeanima/habitat/core/util";

import type { SemanticRecallHit } from "../recall-search.ts";
import {
  focusPassiveRecallQuery,
  stripTimePrefixFromUserContent,
} from "../passive-recall/query.ts";
import { semanticPassiveRecallSearch } from "../passive-recall/search.ts";

export type RetainTextItem = {
  role: "user" | "assistant";
  content: string;
  /** 消息 timestamp，供 AutoLlm `<message t>` */
  t?: string | null;
};

export type RetainPassiveRecallQuotas = {
  user: number;
  assistant: number;
};

/** 总 limit 拆成 user/assistant 两侧配额（仅一侧有正文时该侧拿满额）。 */
export function splitRetainPassiveQuotas(
  totalLimit: number,
  hasUser: boolean,
  hasAssistant: boolean,
): RetainPassiveRecallQuotas {
  const limit = Math.max(0, Math.floor(totalLimit));
  if (!hasUser && !hasAssistant) return { user: 0, assistant: 0 };
  if (!hasUser) return { user: 0, assistant: limit };
  if (!hasAssistant) return { user: limit, assistant: 0 };
  const user = Math.ceil(limit / 2);
  return { user, assistant: limit - user };
}

/** 同 id 保留更高分；按分数降序截断。 */
export function mergeHitsByScore(
  hits: readonly SemanticRecallHit[],
  excludeIds: ReadonlySet<number>,
  limit: number,
): SemanticRecallHit[] {
  if (limit <= 0) return [];
  const best = new Map<number, SemanticRecallHit>();
  for (const hit of hits) {
    if (excludeIds.has(hit.semantic_memory_id)) continue;
    const prev = best.get(hit.semantic_memory_id);
    if (!prev || hit.score > prev.score) best.set(hit.semantic_memory_id, hit);
  }
  return [...best.values()].toSorted((a, b) => b.score - a.score).slice(0, limit);
}

export function mergeRetainPassiveHits(opts: {
  userHits: readonly SemanticRecallHit[];
  assistantHits: readonly SemanticRecallHit[];
  excludeIds: ReadonlySet<number>;
  quotas: RetainPassiveRecallQuotas;
}): SemanticRecallHit[] {
  const userPicked = mergeHitsByScore(opts.userHits, opts.excludeIds, opts.quotas.user);
  const afterUser = new Set(opts.excludeIds);
  for (const h of userPicked) afterUser.add(h.semantic_memory_id);
  const asstPicked = mergeHitsByScore(opts.assistantHits, afterUser, opts.quotas.assistant);
  return [...userPicked, ...asstPicked];
}

async function searchForRoleItems(
  items: readonly RetainTextItem[],
  role: "user" | "assistant",
  searchOpts: {
    limit: number;
    min_score: number;
    min_relative_score: number;
  },
): Promise<SemanticRecallHit[]> {
  const queries = items
    .filter((i) => i.role === role)
    .map((i) => {
      const raw = role === "user" ? stripTimePrefixFromUserContent(i.content) : i.content.trim();
      return focusPassiveRecallQuery(raw);
    })
    .filter(Boolean);

  if (queries.length === 0) return [];

  const batches = await Promise.all(
    queries.map(async (query) => {
      try {
        return await semanticPassiveRecallSearch(query, {
          limit: searchOpts.limit,
          min_score: searchOpts.min_score,
          min_relative_score: searchOpts.min_relative_score,
        });
      } catch (err) {
        // 单条正文仍可能踩 FTS 校验；跳过该条，不拖垮整次 retain
        if (isFtsQueryError(err)) return [];
        throw err;
      }
    }),
  );
  return batches.flat();
}

/** 对本回合 user/assistant 正文分别召回并分配额合并（复用 passive hybrid）。 */
export async function collectRetainPassiveHits(
  items: readonly RetainTextItem[],
  excludeIds: ReadonlySet<number>,
  config: {
    enabled: boolean;
    limit: number;
    min_score: number;
    min_relative_score: number;
  },
): Promise<SemanticRecallHit[]> {
  if (!config.enabled || items.length === 0) return [];

  const hasUser = items.some((i) => i.role === "user");
  const hasAssistant = items.some((i) => i.role === "assistant");
  const quotas = splitRetainPassiveQuotas(config.limit, hasUser, hasAssistant);
  if (quotas.user === 0 && quotas.assistant === 0) return [];

  const searchOpts = {
    limit: config.limit,
    min_score: config.min_score,
    min_relative_score: config.min_relative_score,
  };

  const [userHits, assistantHits] = await Promise.all([
    quotas.user > 0 ? searchForRoleItems(items, "user", searchOpts) : Promise.resolve([]),
    quotas.assistant > 0 ? searchForRoleItems(items, "assistant", searchOpts) : Promise.resolve([]),
  ]);

  return mergeRetainPassiveHits({ userHits, assistantHits, excludeIds, quotas });
}
