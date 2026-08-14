import { getCompressionConfig } from "./compression-config.ts";
import { type CompressionState, formatMessagesForSummary, sliceForSummary } from "./compressor.ts";
import { PROFILE_SUMMARY, runAutoLlmChat } from "@freeanima/habitat/core/llm";
import { getResolvedWorldContext } from "@freeanima/habitat/core/config/world-context";
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

const SUMMARY_INSTRUCTION = `You are a digital life running in FreeAnima. Compress the following conversation history into a concise conversation summary (first person "I"), keeping:
- Partner intent and decisions made
- Open items and agreements
- Key entities, paths, and error conclusions
Do not invent content that did not appear. Output only the summary body—no title or prefix.`;

function buildSummaryUserContent(
  sliceText: string,
  previousSummary: string | undefined,
  summaryMaxTokens: number,
): string {
  const parts = [SUMMARY_INSTRUCTION, `Keep the summary to about ${summaryMaxTokens} tokens.`];
  if (previousSummary?.trim()) {
    parts.push(
      "",
      "## Existing summary (merge new content on top of this)",
      previousSummary.trim(),
      "",
      "## New conversation slice",
      sliceText,
    );
  } else {
    parts.push("", "## Conversation slice", sliceText);
  }
  return parts.join("\n");
}

export type GenerateSummaryResult =
  | { ok: true; summary: string; runId?: string }
  | { ok: false; error: string; runId?: string };

/** Generate/merge summary from pre-compression system_prompt snapshot (no IO) */
export async function generateConversationSummary(
  messages: StoredMessage[],
  prevState: CompressionState | null,
  newState: CompressionState,
  systemPromptSnapshot: string,
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
  const userContent = buildSummaryUserContent(sliceText, prevState?.summary, summaryMaxTokens);
  const runKind = opts?.runKind ?? AUTO_LLM_RUN_KIND_COMPRESSION_SUMMARY;
  const chatMessages = [
    { role: "system" as const, content: systemPromptSnapshot },
    { role: "user" as const, content: userContent },
  ];

  try {
    const recorded = await runAutoLlmChat(
      omitUndefined({
        runName: opts?.parentConversationId ? `${runKind}:${opts.parentConversationId}` : runKind,
        runKind,
        subjectId: getResolvedWorldContext().agent_subject_id,
        messages: chatMessages,
        model: opts?.model,
        profileId: PROFILE_SUMMARY,
        requestParams: COMPRESSION_SUMMARY_REQUEST_PARAMS,
        parentConversationId: opts?.parentConversationId,
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
