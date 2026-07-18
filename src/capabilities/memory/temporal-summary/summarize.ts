import { composeSystemPrompt, decomposeSystemPromptParts } from "../system-prompt.ts";
import { runTemporalSummaryEngine } from "./engine-port.ts";

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
    `字数上限约 ${opts.maxChars} 字。只输出摘要正文，不要标题或列表装饰。`,
    "",
    "—— 材料 ——",
    opts.material.slice(0, 80_000),
  ].join("\n");
  const { content } = await runTemporalSummaryEngine({ systemPrompt, userMessage });
  const trimmed = content.trim();
  if (trimmed.length <= opts.maxChars) return trimmed;
  return trimmed.slice(0, opts.maxChars);
}
