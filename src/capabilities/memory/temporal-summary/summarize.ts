import { composeSystemPrompt, decomposeSystemPromptParts } from "../system-prompt.ts";
import { runTemporalSummaryEngine } from "./engine-port.ts";

/** Shared output constraints appended to every temporal-summary LLM call. */
export function temporalSummaryOutputConstraints(maxChars: number): string {
  return [
    `字数上限约 ${maxChars} 字。`,
    "只输出摘要正文：不要标题、列表装饰、开场寒暄（如「收到」「好的」「我这就…」）或任何元叙述。",
    "写事件级概览（主题与结果）；禁止堆砌内部 ID、逐步 tool/配置操作、逐条通知时间戳。",
    "「无差别」= 不因「是否重要」故意漏事件，≠ 复述全部细节。",
  ].join("");
}

/**
 * Strip leading conversational acknowledgments / meta-narration the model may prepend
 * despite "only output summary body" instructions.
 */
export function stripTemporalSummaryPreamble(text: string): string {
  let s = text.trim();
  // e.g. 「收到，我这就…摘要。」 / 「明白。」 / 「好的，下面是摘要。」
  const ack = /^(?:收到|好的|明白|了解|嗯|行|OK|Ok|ok)(?:[，,！!\s][^\n。！?]*)?[。！?](?:\s*\n)*/u;
  while (ack.test(s)) {
    s = s.replace(ack, "").trim();
  }
  // e.g. 「我将把这段整理成摘要。」 without leading 收到
  const meta =
    /^(?:我(?:这就|就|来|将)(?:把|为|对)?[^\n。！?]*(?:摘要|整理|总结)[^\n。！?]*(?:[。！?]|\n)+)/u;
  while (meta.test(s)) {
    s = s.replace(meta, "").trim();
  }
  return s;
}

export async function summarizeTemporalText(opts: {
  selfContent: string;
  instruction: string;
  material: string;
  maxChars: number;
}): Promise<string> {
  const parts = await decomposeSystemPromptParts(opts.selfContent);
  const systemPrompt = composeSystemPrompt(parts);
  const userMessage = [
    opts.instruction,
    "",
    temporalSummaryOutputConstraints(opts.maxChars),
    "",
    "—— 材料 ——",
    opts.material.slice(0, 80_000),
  ].join("\n");
  const { content } = await runTemporalSummaryEngine({ systemPrompt, userMessage });
  const trimmed = stripTemporalSummaryPreamble(content);
  if (trimmed.length <= opts.maxChars) return trimmed;
  return trimmed.slice(0, opts.maxChars);
}
