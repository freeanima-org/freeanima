import type { ResolvedTemporalSummaryConfig } from "./config.ts";
import { resolveAllSystemRolls } from "./system-rolls.ts";
import type { PeerRollCache } from "./tick.ts";

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

  const sections = rolls.map((r) => `### ${r.label}\n${r.summary}`);
  let text = `## 时间摘要\n\n${sections.join("\n\n")}`;
  let truncated = false;
  if (text.length > config.system_prompt_max_chars) {
    text = `${text.slice(0, config.system_prompt_max_chars)}\n…`;
    truncated = true;
  }
  return { content: text, truncated };
}
