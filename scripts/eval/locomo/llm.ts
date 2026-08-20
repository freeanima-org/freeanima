import { countTokens } from "@freeanima/habitat/core/tokenizer";

import {
  LOCOMO_DEFAULT_MODEL,
  resolveLocomoApiKey,
  resolveLocomoBaseUrl,
  resolveLocomoModel,
} from "./env.ts";

export type LlmAnswerOpts = {
  dryRun: boolean;
  model?: string;
  system: string;
  user: string;
};

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

/**
 * 答题 / 裁判 LLM。
 * - dry-run：不调外网
 * - 真实调用：OpenAI 兼容 HTTP；默认走 OpenCode Go（不读不写 config.yaml）
 *
 * 环境变量：
 *   LOCOMO_API_KEY（或 OPENAI_API_KEY）— OpenCode Go / 网关 Key
 *   LOCOMO_BASE_URL（默认 https://opencode.ai/zen/go/v1）
 *   LOCOMO_MODEL（默认 deepseek-v4-flash；可被 --model 覆盖）
 */
export async function completeText(opts: LlmAnswerOpts): Promise<string> {
  if (opts.dryRun) {
    return "";
  }
  const apiKey = resolveLocomoApiKey();
  if (!apiKey) {
    throw new Error(
      "非 dry-run 需要 LOCOMO_API_KEY（OpenCode Go Key；或 OPENAI_API_KEY）；评测不读写 config.yaml",
    );
  }
  const baseUrl = resolveLocomoBaseUrl();
  const model = opts.model ?? resolveLocomoModel();
  const messages: ChatMessage[] = [
    { role: "system", content: opts.system },
    { role: "user", content: opts.user },
  ];
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`LoCoMo LLM HTTP ${res.status}: ${body.slice(0, 400)}`);
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("LoCoMo LLM: empty completion content");
  }
  return content.trim();
}

export function estimatePromptTokens(prompt: string, model = LOCOMO_DEFAULT_MODEL): number {
  return countTokens(prompt, model);
}

export { LOCOMO_DEFAULT_MODEL as DEFAULT_MODEL };
