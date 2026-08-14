import {
  cstDaySourceRef,
  notifySoftFailure,
  type SoftFailureNotifyResult,
} from "@freeanima/habitat/core/soft-failure";
import type { FoldSystemPromptResult } from "@freeanima/habitat/core/hooks/prompt/fold.ts";

/** Dual-Inbox when system prompt fold truncated or dropped sections (CST-day dedupe). */
export async function notifyPromptFoldBudgetSoftFailure(
  folded: Pick<FoldSystemPromptResult, "truncatedSectionIds" | "droppedSectionIds">,
  opts?: { nowMs?: number },
): Promise<SoftFailureNotifyResult | "noop"> {
  const truncated = folded.truncatedSectionIds;
  const dropped = folded.droppedSectionIds;
  if (truncated.length === 0 && dropped.length === 0) return "noop";

  const nowMs = opts?.nowMs ?? Date.now();
  const parts: string[] = [];
  if (truncated.length > 0) parts.push(`已截断段落：${truncated.join(", ")}`);
  if (dropped.length > 0) parts.push(`已丢弃段落：${dropped.join(", ")}`);

  return notifySoftFailure({
    sourceRef: cstDaySourceRef("prompt:fold_budget", nowMs),
    title: "System prompt 预算截断",
    body: [
      "组装 system prompt 时触发段落或全局字数预算，部分内容已截断或丢弃。",
      ...parts,
      "核心身份段（self / anima-uri-protocol / memory-citation / memory-recall）不会整段丢弃；若反复出现，请检查 prompt.system_prompt_budget_chars 与各段 budgetChars。",
    ].join("\n"),
    payload: {
      kind: "prompt_fold_budget",
      truncated_section_ids: truncated,
      dropped_section_ids: dropped,
    },
    logLabel: "prompt_fold_budget",
  });
}
