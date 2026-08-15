import type { ResolvedTemporalSummaryConfig } from "./config.ts";
import { listTemporalSystemRolls } from "./system-rolls.ts";
import type { PeerRollCache } from "./tick.ts";
import {
  PROMPT_XML_TAGS,
  truncatePromptBodyForXmlBudget,
  wrapPromptXml,
} from "@freeanima/habitat/core/hooks/prompt";

export type TemporalSummarySystemSectionResult = {
  content: string;
  truncated: boolean;
};

export type BuildTemporalSummarySystemSectionOpts = {
  nowMs?: number;
  /** Redis (or in-process) cache for system rollups. */
  peerCache?: PeerRollCache;
  /**
   * @deprecated 拼装路径只读缓存，不再用 selfContent 触发 LLM。
   * 保留字段以免调用方破坏。
   */
  selfContent?: string;
};

async function cachedSystemRollBlocks(
  config: ResolvedTemporalSummaryConfig,
  opts: BuildTemporalSummarySystemSectionOpts,
): Promise<Array<{ label: string; summary: string }>> {
  const { items } = await listTemporalSystemRolls({
    config,
    ...(opts.peerCache ? { peerCache: opts.peerCache } : {}),
    ...(opts.nowMs !== undefined ? { nowMs: opts.nowMs } : {}),
  });
  return items
    .filter((item) => item.cache_hit && item.summary.trim())
    .map((item) => ({ label: item.label, summary: item.summary.trim() }));
}

/** Build system prompt section: 过往日 → 过往月 → 过往年（只读 Redis，miss 跳过）。 */
export async function buildTemporalSummarySystemSection(
  config: ResolvedTemporalSummaryConfig,
  opts: BuildTemporalSummarySystemSectionOpts | number = {},
): Promise<TemporalSummarySystemSectionResult> {
  // Backward-compatible: second arg may be nowMs number from older call sites / tests.
  const normalized: BuildTemporalSummarySystemSectionOpts =
    typeof opts === "number" ? { nowMs: opts } : opts;
  if (!config.enabled) return { content: "", truncated: false };

  const rolls = await cachedSystemRollBlocks(config, normalized);
  if (rolls.length === 0) return { content: "", truncated: false };

  const body = rolls.map((r) => `### ${r.label}\n${r.summary}`).join("\n\n");
  const { body: capped, truncated } = truncatePromptBodyForXmlBudget(
    body,
    config.system_prompt_max_chars,
    { tag: PROMPT_XML_TAGS.temporalSummary },
    "\n…",
  );
  return {
    content: wrapPromptXml(PROMPT_XML_TAGS.temporalSummary, capped),
    truncated,
  };
}

/** Body-only for fold path (xmlTag applied by hook). 只读缓存，不打 LLM。 */
export async function buildTemporalSummarySystemBody(
  config: ResolvedTemporalSummaryConfig,
  opts: BuildTemporalSummarySystemSectionOpts | number = {},
): Promise<{ body: string; truncated: boolean }> {
  const normalized: BuildTemporalSummarySystemSectionOpts =
    typeof opts === "number" ? { nowMs: opts } : opts;
  if (!config.enabled) return { body: "", truncated: false };

  const rolls = await cachedSystemRollBlocks(config, normalized);
  if (rolls.length === 0) return { body: "", truncated: false };

  const body = rolls.map((r) => `### ${r.label}\n${r.summary}`).join("\n\n");
  return truncatePromptBodyForXmlBudget(
    body,
    config.system_prompt_max_chars,
    { tag: PROMPT_XML_TAGS.temporalSummary },
    "\n…",
  );
}
