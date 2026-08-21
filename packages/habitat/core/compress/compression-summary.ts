import { getCompressionConfig } from "./compression-config.ts";
import { type CompressionState, formatMessagesForSummary, sliceForSummary } from "./compressor.ts";
import {
  AUTO_LLM_CHAT_DEFAULT_MAX_DURATION_MS,
  composeAutoLlmPrompt,
  composedAutoLlmPromptToChatMessages,
  runAutoLlmChat,
} from "@freeanima/habitat/core/llm";
import { PROFILE_SUMMARY } from "@freeanima/habitat/core/provider";
import { PROMPT_XML_TAGS } from "@freeanima/habitat/core/hooks/prompt";
import { omitUndefined } from "@freeanima/habitat/core/util";
import type { StoredMessage } from "@freeanima/habitat/core/db/domain";

export const AUTO_LLM_RUN_KIND_COMPRESSION_SUMMARY = "compression-summary";
export const AUTO_LLM_RUN_KIND_HANDOFF_SUMMARY = "handoff-summary";

/**
 * 一次性摘要 completion：关 thinking、禁 tool call（经 params.extra 透传）。
 */
export const COMPRESSION_SUMMARY_REQUEST_PARAMS = {
  extra: {
    thinking: { type: "disabled" },
    tool_choice: "none",
  },
} as const;

const COMPRESSION_SUMMARY_TASK_SPEC = `将给定会话片段压缩为简洁摘要（第一人称「我」），保留：
- 对方意图与已做决定
- 未决事项与约定
- 关键实体、路径与错误结论
不要捏造未出现的内容。只输出摘要正文——无标题或前缀。
摘要篇幅约 {{summary_max_tokens}} tokens。`;

function buildSummaryDataBody(sliceText: string, previousSummary: string | undefined): string {
  const parts: string[] = [];
  if (previousSummary?.trim()) {
    parts.push(
      "## 已有摘要（在此基础上合并新内容）",
      previousSummary.trim(),
      "",
      "## 新会话片段",
      sliceText,
    );
  } else {
    parts.push("## 会话片段", sliceText);
  }
  return parts.join("\n");
}

export type GenerateSummaryResult =
  | { ok: true; summary: string; runId?: string }
  | { ok: false; error: string; runId?: string };

/**
 * 生成/合并压缩摘要。
 * `@deprecatedParam systemPromptSnapshot` 保留签名兼容，**不得**再作为 AutoLlm system。
 */
export async function generateConversationSummary(
  messages: StoredMessage[],
  prevState: CompressionState | null,
  newState: CompressionState,
  _systemPromptSnapshot: string,
  opts?: {
    /** Optional hop0 override; omit to use PROFILE_SUMMARY hop (never meta.model). */
    model?: string;
    preSliced?: boolean;
    parentConversationId?: string;
    runKind?:
      | typeof AUTO_LLM_RUN_KIND_COMPRESSION_SUMMARY
      | typeof AUTO_LLM_RUN_KIND_HANDOFF_SUMMARY;
  },
): Promise<GenerateSummaryResult> {
  const prevL2 = prevState?.l2 ?? null;
  const slice = opts?.preSliced ? messages : sliceForSummary(messages, prevL2, newState.l2);
  if (slice.length === 0 && !prevState?.summary) {
    return { ok: false, error: "No content to summarize" };
  }

  const { summaryMaxTokens } = getCompressionConfig();
  const sliceText = formatMessagesForSummary(slice);
  const runKind = opts?.runKind ?? AUTO_LLM_RUN_KIND_COMPRESSION_SUMMARY;
  const composed = composeAutoLlmPrompt({
    kind: runKind,
    taskSpec: COMPRESSION_SUMMARY_TASK_SPEC,
    taskParams: { summary_max_tokens: summaryMaxTokens },
    dataParts: [
      {
        tag: PROMPT_XML_TAGS.sourceData,
        body: buildSummaryDataBody(sliceText, prevState?.summary),
      },
    ],
  });

  try {
    const recorded = await runAutoLlmChat(
      omitUndefined({
        runName: opts?.parentConversationId ? `${runKind}:${opts.parentConversationId}` : runKind,
        runKind,
        messages: composedAutoLlmPromptToChatMessages(composed),
        model: opts?.model,
        profileId: PROFILE_SUMMARY,
        requestParams: COMPRESSION_SUMMARY_REQUEST_PARAMS,
        parentConversationId: opts?.parentConversationId,
        maxLoopIterations: 1,
        maxDurationMs: AUTO_LLM_CHAT_DEFAULT_MAX_DURATION_MS,
      }),
    );
    if (recorded.status === "error") {
      return omitUndefined({
        ok: false as const,
        error: recorded.error ?? "Summary LLM call failed",
        runId: recorded.runId,
      });
    }
    const summary = recorded.output.trim();
    if (!summary || summary === "(empty)") {
      return omitUndefined({
        ok: false as const,
        error: "Summary LLM returned empty",
        runId: recorded.runId,
      });
    }
    return omitUndefined({ ok: true as const, summary, runId: recorded.runId });
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
