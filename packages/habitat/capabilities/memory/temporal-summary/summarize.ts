import { composeAutoLlmPrompt } from "@freeanima/habitat/core/llm/auto-llm-prompt";
import type { AutoLlmTaskParams } from "@freeanima/habitat/core/llm/auto-llm-prompt";
import { PROMPT_XML_TAGS } from "@freeanima/habitat/core/hooks/prompt";
import { runTemporalSummaryEngine } from "./engine-port.ts";

/**
 * Hard truncate ceiling = target maxChars × 1.5.
 * Prompt still asks for ~maxChars; headroom absorbs CJK/EN token-count drift.
 */
export function temporalSummaryHardCap(maxChars: number): number {
  return Math.ceil(maxChars * 1.5);
}

/** Shared output constraints；字数用 {{max_chars}} 挖空，由 task_params 填充。 */
export const TEMPORAL_SUMMARY_OUTPUT_CONSTRAINTS = [
  "字数上限约 {{max_chars}} 字；必须高度压缩，标题级/一句级，禁止展开细节或写成段落。",
  "只输出摘要正文：不要标题、列表装饰、开场寒暄（如「收到」「好的」「我这就…」）或任何元叙述。",
  "写主题与结果的极短概览；禁止堆砌内部 ID、逐步 tool/配置操作、逐条通知时间戳。",
  "「无差别」= 不因「是否重要」故意漏主题，≠ 复述细节；宁短勿长。",
].join("");

/** @deprecated 使用 TEMPORAL_SUMMARY_OUTPUT_CONSTRAINTS + task_params.max_chars */
export function temporalSummaryOutputConstraints(maxChars: number): string {
  return TEMPORAL_SUMMARY_OUTPUT_CONSTRAINTS.replaceAll("{{max_chars}}", String(maxChars));
}

/** 稳定本轮指令模板（日期等用 {{}}；值进 task_params） */
export const TEMPORAL_SUMMARY_INSTRUCTIONS = {
  globalDay:
    "请为 {{day}}（CST）生成全局客观天摘要：一句级高度压缩，只保留当日主题与结果；无差别、不抒情，禁止细节与流水账。",
  month:
    "请将 {{period_start}} 至 {{period_end}} 的全局天摘要合并为客观月摘要：一句级高度压缩，只留主题主线。",
  year: "请将 {{year}} 年各月摘要合并为客观年摘要：一句级高度压缩，只留年度主线与重要结果。",
  chunk: "请对本段会话新增消息做客观、无差别的一句级增量摘要：只写主题与结果，禁止细节与内部 ID。",
  peerRoll: "将多段他会话客观摘要合并为一条时段合摘要：一句级高度压缩，只留主题与结果。",
  pastDays:
    "请将本月今天之前的全局天摘要合并为一条客观「过往日」合摘要：倒叙优先近期主题，一句级高度压缩。",
  pastMonths:
    "请将今年本月以前的月摘要合并为一条客观「过往月」合摘要：倒叙优先近期主题，一句级高度压缩。",
  pastYears:
    "请将今年以前的年摘要合并为一条客观「过往年」合摘要：倒叙优先近期主题，一句级高度压缩。",
} as const;

/**
 * 层 2 骨架：本轮 instruction 模板 + 输出约束一并写入 task_spec（可含 {{}}）。
 * 实例值只进 task_params。
 */
export function formatTemporalSummaryTaskSpec(opts: { instruction: string }): string {
  return [
    "你是时间摘要引擎：按本轮指令与任务参数，对后续材料生成客观、高度压缩的时间窗摘要。",
    opts.instruction.trim(),
    TEMPORAL_SUMMARY_OUTPUT_CONSTRAINTS,
  ].join("\n\n");
}

export const TEMPORAL_SUMMARY_TASK_SPEC = formatTemporalSummaryTaskSpec({
  instruction: "（本轮指令由调用方写入 task_spec 模板）",
});

/**
 * Strip leading conversational acknowledgments / meta-narration the model may prepend
 * despite "only output summary body" instructions.
 */
export function stripTemporalSummaryPreamble(text: string): string {
  let s = text.trim();
  const ack = /^(?:收到|好的|明白|了解|嗯|行|OK|Ok|ok)(?:[，,！!\s][^\n。！?]*)?[。！?](?:\s*\n)*/u;
  while (ack.test(s)) {
    s = s.replace(ack, "").trim();
  }
  const meta =
    /^(?:我(?:这就|就|来|将)(?:把|为|对)?[^\n。！?]*(?:摘要|整理|总结)[^\n。！?]*(?:[。！?]|\n)+)/u;
  while (meta.test(s)) {
    s = s.replace(meta, "").trim();
  }
  return s;
}

export async function summarizeTemporalText(opts: {
  /** 可含 {{name}} 的本轮指令模板 */
  instruction: string;
  material: string;
  maxChars: number;
  /** 填空；自动合并 max_chars */
  params?: AutoLlmTaskParams;
}): Promise<string> {
  const taskSpec = formatTemporalSummaryTaskSpec({ instruction: opts.instruction });
  const { systemPrompt, userMessages } = composeAutoLlmPrompt({
    kind: "temporal-summary",
    taskSpec,
    taskParams: {
      ...opts.params,
      max_chars: opts.maxChars,
    },
    dataParts: [{ tag: PROMPT_XML_TAGS.sourceData, body: opts.material.slice(0, 80_000) }],
  });
  const { content } = await runTemporalSummaryEngine({
    systemPrompt,
    userMessages,
  });
  const trimmed = stripTemporalSummaryPreamble(content);
  const hardCap = temporalSummaryHardCap(opts.maxChars);
  if (trimmed.length <= hardCap) return trimmed;
  return trimmed.slice(0, hardCap);
}
