import { omitUndefined } from "@freeanima/host/core/util";
import { PROFILE_SUMMARY } from "@freeanima/host/core/provider";
import type { ChatCompletion } from "@freeanima/host/core/provider";
import { runAutoLlmChat } from "./auto-llm-chat.ts";
import type { LlmRuntime } from "./llm-stack.ts";

export const AUTO_LLM_RUN_KIND_CONVERSATION_TITLE = "conversation-title";

/** Title is at most 50 chars; cap generation budget tightly. */
export const SESSION_TITLE_MAX_OUTPUT_TOKENS = 30;

/**
 * 关闭 thinking：短标题不需要推理，且 thinking 常与 content 共用 max_tokens。
 * tool_choice none：一次性 completion，禁止 tool call。
 * 兼容忽略 thinking 开关的网关（仍靠 maxOutputTokens 收紧）。
 */
export const SESSION_TITLE_REQUEST_PARAMS = {
  maxOutputTokens: SESSION_TITLE_MAX_OUTPUT_TOKENS,
  extra: {
    thinking: { type: "disabled" },
    tool_choice: "none",
  },
} as const;

const SESSION_TITLE_INSTRUCTION = `You label chat threads in a sidebar (like ChatGPT or WeChat). Read ONLY the user's first message.

Write a short TOPIC label (at most 50 characters) in the same language as the user.
The label names what the conversation is about — it is NOT a reply to the user.

Rules:
- Output ONLY the title text: no quotes, prefix, markdown, or explanation.
- NEVER write in assistant voice: no greetings, no addressing the user (你/主人/亲爱的), no roleplay lines, no filler like "喵".
- NEVER continue the scene or paraphrase dialogue; use a concise noun phrase or situation name.
- For stage-direction or roleplay openers, name the scene/topic, not the line itself.

Examples (Chinese):
- User: "（轻轻点头）马上了，这就到小区门口" → 小区门口碰面
- User: "我有些育儿问题，帮帮我吧" → 育儿问题
- Bad title (reply, not a label): "好，到家了。懂了，去洗澡。"
- Good title: "回家洗澡"`;

export const SESSION_TITLE_MAX_LEN = 50;

const SURROUNDING_QUOTE = new Set(['"', "'", "`"]);

function stripSurroundingQuotes(text: string): string {
  let start = 0;
  let end = text.length;
  while (start < end && SURROUNDING_QUOTE.has(text[start] ?? "")) start++;
  while (end > start && SURROUNDING_QUOTE.has(text[end - 1] ?? "")) end--;
  return text.slice(start, end);
}

export function sanitizeConversationTitle(raw: string): string {
  return stripSurroundingQuotes(raw.trim())
    .replace(/\s+/g, " ")
    .replace(/[\r\n]+/g, " ")
    .slice(0, SESSION_TITLE_MAX_LEN)
    .trim();
}

export function fallbackConversationTitle(userText: string): string {
  const withoutStage = userText
    .replace(/\([^)]*\)/g, " ")
    .replace(/（[^）]*）/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const base = withoutStage || userText.trim();
  return sanitizeConversationTitle(base).slice(0, 30).trim();
}

export type GenerateConversationTitleDiagnostics = {
  model?: string;
  finish_reason?: string | null;
  had_reasoning?: boolean;
};

export type GenerateConversationTitleResult =
  | ({ ok: true; title: string } & GenerateConversationTitleDiagnostics)
  | ({ ok: false; error: string } & GenerateConversationTitleDiagnostics);

function extractTitleFromCompletion(resp: ChatCompletion): string {
  // Only use final content; reasoning is chain-of-thought, not a sidebar label.
  return sanitizeConversationTitle(resp.content ?? "");
}

function completionDiagnostics(resp: ChatCompletion): GenerateConversationTitleDiagnostics {
  return omitUndefined({
    model: resp.model,
    finish_reason: resp.finish_reason,
    had_reasoning: Boolean(String(resp.reasoning ?? "").trim()),
  });
}

export async function generateConversationTitle(
  userText: string,
  opts?: { runtime?: LlmRuntime; model?: string; parentConversationId?: string },
): Promise<GenerateConversationTitleResult> {
  const trimmed = userText.trim();
  if (!trimmed) {
    return { ok: false, error: "empty user text" };
  }

  try {
    const chatMessages = [
      { role: "system" as const, content: SESSION_TITLE_INSTRUCTION },
      { role: "user" as const, content: trimmed },
    ];
    const recorded = await runAutoLlmChat(
      omitUndefined({
        runName: opts?.parentConversationId
          ? `conversation-title:${opts.parentConversationId}`
          : "conversation-title",
        runKind: AUTO_LLM_RUN_KIND_CONVERSATION_TITLE,
        messages: chatMessages,
        profileId: PROFILE_SUMMARY,
        runtime: opts?.runtime,
        model: opts?.model,
        requestParams: SESSION_TITLE_REQUEST_PARAMS,
        parentConversationId: opts?.parentConversationId,
      }),
    );
    if (recorded.status === "error" || !recorded.completion) {
      return { ok: false, error: recorded.error ?? "LLM title call failed" };
    }
    const resp = recorded.completion;
    const title = extractTitleFromCompletion(resp);
    const diagnostics = completionDiagnostics(resp);
    if (!title) {
      return {
        ok: false,
        error: "LLM returned empty title",
        ...diagnostics,
      };
    }
    return { ok: true, title, ...diagnostics };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
