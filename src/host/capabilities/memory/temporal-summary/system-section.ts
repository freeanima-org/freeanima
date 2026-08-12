import type { ResolvedTemporalSummaryConfig } from "./config.ts";
import { resolveAllSystemRolls } from "./system-rolls.ts";
import type { PeerRollCache } from "./tick.ts";
import {
  PROMPT_XML_TAGS,
  truncatePromptBodyForXmlBudget,
  wrapPromptXml,
} from "@freeanima/host/core/hooks/prompt";

export type TemporalSummarySystemSectionResult = {
  content: string;
  truncated: boolean;
};

export type BuildTemporalSummarySystemSectionOpts = {
  nowMs?: number;
  /** Redis (or in-process) cache for system rollups. */
  peerCache?: PeerRollCache;
  /** Identity context for LLM rollup; required for miss path when sources exist. */
  selfContent?: string;
};

/** Build system prompt section: 过往日 → 过往月 → 过往年 (each ≤ global_day_max_chars). */
export async function buildTemporalSummarySystemSection(
  config: ResolvedTemporalSummaryConfig,
  opts: BuildTemporalSummarySystemSectionOpts | number = {},
): Promise<TemporalSummarySystemSectionResult> {
  // Backward-compatible: second arg may be nowMs number from older call sites / tests.
  const normalized: BuildTemporalSummarySystemSectionOpts =
    typeof opts === "number" ? { nowMs: opts } : opts;
  if (!config.enabled) return { content: "", truncated: false };

  const rolls = await resolveAllSystemRolls({
    config,
    ...(normalized.peerCache ? { peerCache: normalized.peerCache } : {}),
    ...(normalized.selfContent !== undefined ? { selfContent: normalized.selfContent } : {}),
    ...(normalized.nowMs !== undefined ? { nowMs: normalized.nowMs } : {}),
  });
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

/** Body-only for fold path (xmlTag applied by hook). */
export async function buildTemporalSummarySystemBody(
  config: ResolvedTemporalSummaryConfig,
  opts: BuildTemporalSummarySystemSectionOpts | number = {},
): Promise<{ body: string; truncated: boolean }> {
  const normalized: BuildTemporalSummarySystemSectionOpts =
    typeof opts === "number" ? { nowMs: opts } : opts;
  if (!config.enabled) return { body: "", truncated: false };

  const rolls = await resolveAllSystemRolls({
    config,
    ...(normalized.peerCache ? { peerCache: normalized.peerCache } : {}),
    ...(normalized.selfContent !== undefined ? { selfContent: normalized.selfContent } : {}),
    ...(normalized.nowMs !== undefined ? { nowMs: normalized.nowMs } : {}),
  });
  if (rolls.length === 0) return { body: "", truncated: false };

  const body = rolls.map((r) => `### ${r.label}\n${r.summary}`).join("\n\n");
  return truncatePromptBodyForXmlBudget(
    body,
    config.system_prompt_max_chars,
    { tag: PROMPT_XML_TAGS.temporalSummary },
    "\n…",
  );
}
