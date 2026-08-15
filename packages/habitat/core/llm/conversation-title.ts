import { omitUndefined } from "@freeanima/habitat/core/util";
import { getResolvedWorldContext } from "@freeanima/habitat/core/config/world-context";
import { PROFILE_SUMMARY } from "@freeanima/habitat/core/provider";
import type { ChatCompletion } from "@freeanima/habitat/core/provider";
import { PROMPT_XML_TAGS } from "@freeanima/habitat/core/hooks/prompt";
import {
  AUTO_LLM_CHAT_DEFAULT_MAX_DURATION_MS,
  composeAutoLlmPrompt,
  composedAutoLlmPromptToChatMessages,
} from "./auto-llm-prompt.ts";
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

const SESSION_TITLE_TASK_SPEC = `为侧栏会话生成短主题标签（最多 50 字），语言与用户首条消息一致。
标签是话题名，不是对用户的回复。
规则：只输出标题正文；无引号/前缀/markdown；禁止助手口吻与角色扮演续写；用简洁名词短语。`;

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
    had_reasoning: Boolean((resp.reasoning ?? "").trim()),
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
    const composed = composeAutoLlmPrompt({
      kind: AUTO_LLM_RUN_KIND_CONVERSATION_TITLE,
      taskSpec: SESSION_TITLE_TASK_SPEC,
      dataParts: [{ tag: PROMPT_XML_TAGS.sourceData, body: trimmed }],
    });
    const recorded = await runAutoLlmChat(
      omitUndefined({
        runName: opts?.parentConversationId
          ? `conversation-title:${opts.parentConversationId}`
          : "conversation-title",
        runKind: AUTO_LLM_RUN_KIND_CONVERSATION_TITLE,
        subjectId: getResolvedWorldContext().agent_subject_id,
        messages: composedAutoLlmPromptToChatMessages(composed),
        profileId: PROFILE_SUMMARY,
        runtime: opts?.runtime,
        model: opts?.model,
        requestParams: SESSION_TITLE_REQUEST_PARAMS,
        parentConversationId: opts?.parentConversationId,
        maxTurns: 1,
        maxDurationMs: AUTO_LLM_CHAT_DEFAULT_MAX_DURATION_MS,
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
