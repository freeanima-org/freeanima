import { getCompressionConfig } from "./compression-config.ts";
import { type CompressionState, formatMessagesForSummary, sliceForSummary } from "./compressor.ts";
import { chat, PROFILE_SUMMARY } from "@freeanima/engine-llm";
import type { SessionMessage } from "@freeanima/engine-db/domain";

const SUMMARY_INSTRUCTION = `你是运行在逸灵风中的数字生命。请将以下对话历史压缩为简洁的会话摘要（第一人称「我」），保留：
- 伙伴意图与已做决策
- 未完成事项与约定
- 关键实体、路径、错误结论
禁止编造未出现的内容。只输出摘要正文，不要标题或前缀。`;

function buildSummaryUserContent(
  sliceText: string,
  previousSummary: string | undefined,
  summaryMaxTokens: number,
): string {
  const parts = [SUMMARY_INSTRUCTION, `摘要长度请控制在约 ${summaryMaxTokens} token 以内。`];
  if (previousSummary?.trim()) {
    parts.push(
      "",
      "## 已有摘要（请在此基础上合并本次新增内容）",
      previousSummary.trim(),
      "",
      "## 本次新增对话片段",
      sliceText,
    );
  } else {
    parts.push("", "## 对话片段", sliceText);
  }
  return parts.join("\n");
}

export type GenerateSummaryResult = { ok: true; summary: string } | { ok: false; error: string };

/** 使用压缩前的 system_prompt 快照生成/增量合并摘要（无 IO） */
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
    return { ok: false, error: "无待摘要内容" };
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
    if (!summary) return { ok: false, error: "摘要 LLM 返回空" };
    return { ok: true, summary };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
