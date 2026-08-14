import {
  listMessagesByPosRange,
  patchConversationMeta,
} from "@freeanima/habitat/core/db/pg/conversation";
import { formatCstIso, omitUndefined } from "@freeanima/habitat/core/util";
import type { CompressionState } from "@freeanima/habitat/core/db/domain";
import { getRuntimeLogger } from "@freeanima/habitat/core/config";
import { cstDaySourceRef, notifySoftFailure } from "@freeanima/habitat/core/soft-failure";
import { generateConversationSummary } from "./compression-summary.ts";

export type CompressionSummaryPostCut = (conversationId: string) => Promise<void>;

export type CompressionSummaryJobResult = {
  ok: boolean;
  summary?: string;
  error?: string;
  runId?: string;
};

let postCutRebuild: CompressionSummaryPostCut | null = null;

export function registerCompressionSummaryPostCut(fn: CompressionSummaryPostCut): void {
  postCutRebuild = fn;
}

export function resetCompressionSummaryPostCutForTests(): void {
  postCutRebuild = null;
}

const pendingCompressionSummaries = new Map<string, Promise<CompressionSummaryJobResult>>();

/** Await in-flight async conversation summaries (integration teardown must call before restoring FREEANIMA_HOME) */
export async function flushCompressionSummaries(
  conversationId?: string,
): Promise<CompressionSummaryJobResult | undefined> {
  if (conversationId !== undefined) {
    const p = pendingCompressionSummaries.get(conversationId);
    if (p) return await p;
    return undefined;
  }
  await Promise.all(pendingCompressionSummaries.values());
  return undefined;
}

/**
 * Drop pending map entries so teardown no longer awaits them.
 * In-flight jobs may still finish; they must re-check FREEANIMA_HOME before writing.
 */
export function abandonCompressionSummaries(): void {
  pendingCompressionSummaries.clear();
}

function homeStillMatches(homeAtSchedule: string): boolean {
  return (process.env.FREEANIMA_HOME ?? "") === homeAtSchedule;
}

async function patchConversationCompression(
  conversationId: string,
  compression: CompressionState,
): Promise<void> {
  await patchConversationMeta(conversationId, { compression });
}

async function finalizeCompressionSummary(
  conversationId: string,
  prevState: CompressionState | null,
  cutState: CompressionState,
  systemPromptSnapshot: string,
  model: string,
  homeAtSchedule: string,
): Promise<CompressionSummaryJobResult> {
  if (!homeStillMatches(homeAtSchedule)) {
    getRuntimeLogger()
      .with({ component: "compression" })
      .warn(`Skipping conversation summary (FREEANIMA_HOME changed): ${conversationId}`);
    return { ok: false, error: "FREEANIMA_HOME changed; summary skipped" };
  }
  const prevL2 = prevState?.l2 ?? null;
  const fromPos = (prevL2 ?? 0) + 1;
  const slice = await listMessagesByPosRange(conversationId, fromPos, cutState.l2);

  const gen = await generateConversationSummary(
    slice,
    prevState,
    cutState,
    systemPromptSnapshot,
    model,
    { preSliced: true, parentConversationId: conversationId },
  );

  if (!homeStillMatches(homeAtSchedule)) {
    getRuntimeLogger()
      .with({ component: "compression" })
      .warn(
        `Skipping conversation summary writeback (FREEANIMA_HOME changed after LLM): ${conversationId}`,
      );
    return { ok: false, error: "FREEANIMA_HOME changed; summary skipped" };
  }

  const merged: CompressionState = {
    ...cutState,
    summary_at: formatCstIso(),
  };
  if (gen.ok) {
    merged.summary = gen.summary;
  } else {
    getRuntimeLogger()
      .with({ component: "compression" })
      .error(`Conversation summary generation failed: ${conversationId}`, {
        err: gen.error,
        runId: gen.runId,
      });
    void notifySoftFailure({
      sourceRef: cstDaySourceRef("compress:summary_failed"),
      title: "会话压缩摘要生成失败",
      body: [
        "压缩边界变更后异步摘要失败，已保留既有 summary 继续运行。",
        `conversation_id=${conversationId}`,
        `错误：${gen.error}`,
      ].join("\n"),
      payload: {
        kind: "compress_summary_failed",
        conversation_id: conversationId,
        error: gen.error,
        run_id: gen.runId ?? null,
      },
      logLabel: "compress_summary",
    });
    // 保留既有 summary，避免失败跑把已有摘要抹掉（并发 patch 另有 mergeCompressionKeepingSummary）
    if (cutState.summary?.trim()) {
      merged.summary = cutState.summary;
    } else if (prevState?.summary?.trim()) {
      merged.summary = prevState.summary;
    }
  }

  await patchConversationCompression(conversationId, merged);
  if (postCutRebuild) {
    try {
      await postCutRebuild(conversationId);
    } catch (e) {
      getRuntimeLogger()
        .with({ component: "compression" })
        .error(`Failed to rebuild system_prompt after compression: ${conversationId}`, {
          err: String(e),
        });
    }
  }

  if (gen.ok) {
    return omitUndefined({ ok: true as const, summary: gen.summary, runId: gen.runId });
  }
  return omitUndefined({ ok: false as const, error: gen.error, runId: gen.runId });
}

/** Schedule async summary generation when compression boundaries change */
export function scheduleCompressionSummary(
  conversationId: string,
  prevState: CompressionState | null,
  cutState: CompressionState,
  systemPromptSnapshot: string,
  model: string,
): void {
  const homeAtSchedule = process.env.FREEANIMA_HOME ?? "";
  const prev = pendingCompressionSummaries.get(conversationId);
  const run = async (): Promise<CompressionSummaryJobResult> => {
    if (prev) await prev;
    return finalizeCompressionSummary(
      conversationId,
      prevState,
      cutState,
      systemPromptSnapshot,
      model,
      homeAtSchedule,
    );
  };
  const p = run()
    .catch((e): CompressionSummaryJobResult => {
      getRuntimeLogger()
        .with({ component: "compression" })
        .error(`Conversation summary pipeline error: ${conversationId}`, {
          err: String(e),
        });
      void notifySoftFailure({
        sourceRef: cstDaySourceRef("compress:summary_failed"),
        title: "会话压缩摘要生成失败",
        body: [
          "压缩摘要流水线异常，已旁路继续。",
          `conversation_id=${conversationId}`,
          `错误：${String(e)}`,
        ].join("\n"),
        payload: {
          kind: "compress_summary_failed",
          conversation_id: conversationId,
          error: String(e),
        },
        logLabel: "compress_summary",
      });
      return { ok: false, error: String(e) };
    })
    .finally(() => {
      if (pendingCompressionSummaries.get(conversationId) === p) {
        pendingCompressionSummaries.delete(conversationId);
      }
    });
  pendingCompressionSummaries.set(conversationId, p);
}
