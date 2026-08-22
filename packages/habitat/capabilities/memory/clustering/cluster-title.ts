/**
 * 语义记忆簇短标题：按样本 entity id 指纹 Redis 缓存 + LLM 生成。
 * 命中与新生成均刷新一个月 TTL。
 */

import { omitUndefined } from "@freeanima/habitat/core/util";
import { PROFILE_SUMMARY } from "@freeanima/habitat/core/provider";
import { PROMPT_XML_TAGS } from "@freeanima/habitat/core/hooks/prompt";
import {
  AUTO_LLM_CHAT_DEFAULT_MAX_DURATION_MS,
  composeAutoLlmPrompt,
  composedAutoLlmPromptToChatMessages,
} from "@freeanima/habitat/core/llm/auto-llm-prompt.ts";
import { runAutoLlmChat } from "@freeanima/habitat/core/llm/auto-llm-chat.ts";
import type { LlmRuntime } from "@freeanima/habitat/core/llm/llm-stack.ts";
import {
  REDIS_CACHE_KEY_PREFIX,
  cacheGetJson,
  cacheSetJson,
} from "@freeanima/habitat/core/redis/cache.ts";
import { listSemanticClusterTitleSamples } from "@freeanima/habitat/core/db/pg/search/clustering-repo.ts";
import { logCapability as logComponent } from "@freeanima/habitat/core/config/capability-injection";

const log = logComponent("memory.clustering");

export const AUTO_LLM_RUN_KIND_SEMANTIC_CLUSTER_TITLE = "semantic-cluster-title";

export const SEMANTIC_CLUSTER_TITLE_MAX_LEN = 8;
export const SEMANTIC_CLUSTER_TITLE_MAX_OUTPUT_TOKENS = 16;
export const SEMANTIC_CLUSTER_TITLE_TTL_SECONDS = 30 * 24 * 60 * 60;
export const SEMANTIC_CLUSTER_TITLE_SAMPLE_LIMIT = 3;

export const SEMANTIC_CLUSTER_TITLE_REQUEST_PARAMS = {
  maxOutputTokens: SEMANTIC_CLUSTER_TITLE_MAX_OUTPUT_TOKENS,
  extra: {
    thinking: { type: "disabled" },
    tool_choice: "none",
  },
} as const;

const TASK_SPEC = `根据若干条语义记忆摘要，为这一簇生成主题标签。
规则：只输出一个词或极短名词（最多 ${SEMANTIC_CLUSTER_TITLE_MAX_LEN} 个汉字/字符）；
禁止完整句子、顿号并列、英文长标识符；语言与材料一致；无引号/前缀/markdown。`;

const SURROUNDING_QUOTE = new Set(['"', "'", "`", "「", "」", "『", "』"]);

export function sanitizeSemanticClusterTitle(raw: string): string {
  let text = raw
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[\r\n]+/g, " ");
  let start = 0;
  let end = text.length;
  while (start < end && SURROUNDING_QUOTE.has(text[start] ?? "")) start++;
  while (end > start && SURROUNDING_QUOTE.has(text[end - 1] ?? "")) end--;
  text = text.slice(start, end).trim();
  // 若含顿号/逗号并列，只取第一段
  const firstChunk = text.split(/[、，,/;；|]/)[0]?.trim() ?? text;
  return firstChunk.slice(0, SEMANTIC_CLUSTER_TITLE_MAX_LEN).trim();
}

export function semanticClusterTitleCacheKey(sampleEntityIds: readonly number[]): string {
  const ids = [...sampleEntityIds]
    .filter((id) => Number.isInteger(id) && id > 0)
    .toSorted((a, b) => a - b);
  // v2：缩短 title 上限后换键，避免继续命中过长旧缓存
  return `${REDIS_CACHE_KEY_PREFIX}semantic-cluster-title:v2:${ids.join("-")}`;
}

type CachedTitle = { title: string };

function sampleMaterialText(
  samples: Array<{ title: string; summary: string; content: string }>,
): string {
  const parts: string[] = [];
  for (const s of samples) {
    const line = [s.title, s.summary, s.content]
      .map((x) => x.trim())
      .filter(Boolean)
      .join(" — ");
    if (line) parts.push(line.slice(0, 240));
  }
  return parts.join("\n");
}

export async function generateSemanticClusterTitle(
  material: string,
  opts?: { runtime?: LlmRuntime; model?: string },
): Promise<{ ok: true; title: string } | { ok: false; error: string }> {
  const trimmed = material.trim();
  if (!trimmed) return { ok: false, error: "empty material" };

  try {
    const composed = composeAutoLlmPrompt({
      kind: AUTO_LLM_RUN_KIND_SEMANTIC_CLUSTER_TITLE,
      taskSpec: TASK_SPEC,
      dataParts: [{ tag: PROMPT_XML_TAGS.sourceData, body: trimmed }],
    });
    const recorded = await runAutoLlmChat(
      omitUndefined({
        runName: "semantic-cluster-title",
        runKind: AUTO_LLM_RUN_KIND_SEMANTIC_CLUSTER_TITLE,
        messages: composedAutoLlmPromptToChatMessages(composed),
        profileId: PROFILE_SUMMARY,
        runtime: opts?.runtime,
        model: opts?.model,
        requestParams: SEMANTIC_CLUSTER_TITLE_REQUEST_PARAMS,
        maxLoopIterations: 1,
        maxDurationMs: AUTO_LLM_CHAT_DEFAULT_MAX_DURATION_MS,
      }),
    );
    if (recorded.status === "error" || !recorded.completion) {
      return { ok: false, error: recorded.error ?? "LLM cluster title call failed" };
    }
    const title = sanitizeSemanticClusterTitle(recorded.completion.content ?? "");
    if (!title) return { ok: false, error: "LLM returned empty title" };
    return { ok: true, title };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/**
 * 只读：样本 + Redis 命中则返回 title（不刷 TTL、不调 LLM）。
 * 列表接口用此路径，避免串行 LLM 拖垮 RPC 超时。
 */
export async function peekSemanticClusterTitle(clusterId: number): Promise<string | null> {
  if (!Number.isInteger(clusterId) || clusterId < 0) return null;

  const samples = await listSemanticClusterTitleSamples(clusterId, {
    limit: SEMANTIC_CLUSTER_TITLE_SAMPLE_LIMIT,
  });
  if (samples.length === 0) return null;

  const key = semanticClusterTitleCacheKey(samples.map((s) => s.entityId));
  const cached = await cacheGetJson<CachedTitle>(key);
  if (!cached?.title) return null;
  const title = sanitizeSemanticClusterTitle(cached.title);
  return title || null;
}

/**
 * 确保某簇有 title：按 entity id 升序取 ≤3 样本，Redis 命中则刷 TTL，否则 LLM 生成后写入。
 * Fail-open：失败返回 null。
 */
export async function ensureSemanticClusterTitle(
  clusterId: number,
  opts?: { runtime?: LlmRuntime; model?: string; world_id?: number },
): Promise<string | null> {
  if (!Number.isInteger(clusterId) || clusterId < 0) return null;

  const samples = await listSemanticClusterTitleSamples(
    clusterId,
    omitUndefined({
      limit: SEMANTIC_CLUSTER_TITLE_SAMPLE_LIMIT,
      world_id: opts?.world_id,
    }),
  );
  if (samples.length === 0) return null;

  const ids = samples.map((s) => s.entityId);
  const key = semanticClusterTitleCacheKey(ids);
  const cached = await cacheGetJson<CachedTitle>(key);
  if (cached?.title) {
    const title = sanitizeSemanticClusterTitle(cached.title);
    if (title) {
      await cacheSetJson(key, { title }, SEMANTIC_CLUSTER_TITLE_TTL_SECONDS);
      return title;
    }
  }

  const material = sampleMaterialText(samples);
  const generated = await generateSemanticClusterTitle(material, opts);
  if (!generated.ok) {
    log.warn("cluster title generation failed", { clusterId, error: generated.error });
    return null;
  }
  await cacheSetJson(key, { title: generated.title }, SEMANTIC_CLUSTER_TITLE_TTL_SECONDS);
  return generated.title;
}

/** 校准后预热：串行 ensure，失败不抛 */
export async function warmSemanticClusterTitles(
  clusterIds: readonly number[],
  opts?: { world_id?: number },
): Promise<{ attempted: number; ok: number }> {
  let ok = 0;
  for (const clusterId of clusterIds) {
    if (!Number.isInteger(clusterId) || clusterId < 0) continue;
    try {
      const title = await ensureSemanticClusterTitle(
        clusterId,
        omitUndefined({ world_id: opts?.world_id }),
      );
      if (title) ok += 1;
    } catch (e) {
      log.warn("cluster title warm failed", { clusterId, error: String(e) });
    }
  }
  return { attempted: clusterIds.length, ok };
}
