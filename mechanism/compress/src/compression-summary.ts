import { getCompressionConfig } from "./compression-config.ts";
import { type CompressionState, formatMessagesForSummary, sliceForSummary } from "./compressor.ts";
import { chat, PROFILE_SUMMARY } from "@freeanima/mechanism-llm";
import type { SessionMessage } from "@freeanima/storage-db/domain";

const SUMMARY_INSTRUCTION = `You are a digital life running in FreeAnima. Compress the following conversation history into a concise session summary (first person "I"), keeping:
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

export type GenerateSummaryResult = { ok: true; summary: string } | { ok: false; error: string };

/** Generate/merge summary from pre-compression system_prompt snapshot (no IO) */
export async function generateSessionSummary(
  messages: SessionMessage[],
  prevState: CompressionState | null,
  newState: CompressionState,
  systemPromptSnapshot: string,
  model: string,
  opts?: { preSliced?: boolean },
): Promise<GenerateSummaryResult> {
  const prevL2 = prevState?.l2 ?? null;
  const slice = opts?.preSliced ? messages : sliceForSummary(messages, prevL2, newState.l2);
  if (!slice.length && !prevState?.summary) {
    return { ok: false, error: "No content to summarize" };
  }

  const { summaryMaxTokens } = getCompressionConfig();
  const sliceText = formatMessagesForSummary(slice);
  const userContent = buildSummaryUserContent(sliceText, prevState?.summary, summaryMaxTokens);

  try {
    const resp = await chat(
      [
        { role: "system", content: systemPromptSnapshot },
        { role: "user", content: userContent },
      ],
      { model, profileId: PROFILE_SUMMARY },
    );
    const summary = (resp.content ?? "").trim();
    if (!summary) return { ok: false, error: "Summary LLM returned empty" };
    return { ok: true, summary };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
