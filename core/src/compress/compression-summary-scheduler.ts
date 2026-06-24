import type { PgRepositories } from "@freeanima/core/repos";
import { formatCstIso } from "@freeanima/core/util";
import type { CompressionState } from "@freeanima/core/db/domain";
import { getRuntimeLogger } from "@freeanima/core/config";
import { generateConversationSummary } from "./compression-summary.ts";

export type CompressionSummaryPostCut = (
  repos: PgRepositories,
  conversationId: string,
) => Promise<void>;

let postCutRebuild: CompressionSummaryPostCut | null = null;

export function registerCompressionSummaryPostCut(fn: CompressionSummaryPostCut): void {
  postCutRebuild = fn;
}

export function resetCompressionSummaryPostCutForTests(): void {
  postCutRebuild = null;
}

const pendingCompressionSummaries = new Map<string, Promise<void>>();

/** Await in-flight async conversation summaries (integration teardown must call before restoring FREEANIMA_HOME) */
export async function flushCompressionSummaries(
  _repos: PgRepositories,
  conversationId?: string,
): Promise<void> {
  if (conversationId !== undefined) {
    const p = pendingCompressionSummaries.get(conversationId);
    if (p) await p;
    return;
  }
  await Promise.all([...pendingCompressionSummaries.values()]);
}

async function patchConversationCompression(
  repos: PgRepositories,
  conversationId: string,
  compression: CompressionState,
): Promise<void> {
  if (!repos.pgAvailable) return;
  await repos.conversation.patchConversationMeta(conversationId, { compression });
}

async function finalizeCompressionSummary(
  repos: PgRepositories,
  conversationId: string,
  prevState: CompressionState | null,
  cutState: CompressionState,
  systemPromptSnapshot: string,
  model: string,
  homeAtSchedule: string,
): Promise<void> {
  if ((process.env.FREEANIMA_HOME ?? "") !== homeAtSchedule) {
    getRuntimeLogger()
      .with({ component: "compression" })
      .warn(`Skipping conversation summary (FREEANIMA_HOME changed): ${conversationId}`);
    return;
  }
  const prevL2 = prevState?.l2 ?? null;
  const fromPos = (prevL2 ?? 0) + 1;
  const slice = repos.pgAvailable
    ? await repos.conversation.listMessagesByPosRange(conversationId, fromPos, cutState.l2)
    : [];

  const gen = await generateConversationSummary(
    slice,
    prevState,
    cutState,
    systemPromptSnapshot,
    model,
    { preSliced: true },
  );

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
      });
  }

  await patchConversationCompression(repos, conversationId, merged);
  if (postCutRebuild) {
    try {
      await postCutRebuild(repos, conversationId);
    } catch (e) {
      getRuntimeLogger()
        .with({ component: "compression" })
        .error(`Failed to rebuild system_prompt after compression: ${conversationId}`, {
          err: String(e),
        });
    }
  }
}

/** Schedule async summary generation when compression boundaries change */
export function scheduleCompressionSummary(
  repos: PgRepositories,
  conversationId: string,
  prevState: CompressionState | null,
  cutState: CompressionState,
  systemPromptSnapshot: string,
  model: string,
): void {
  const homeAtSchedule = process.env.FREEANIMA_HOME ?? "";
  const prev = pendingCompressionSummaries.get(conversationId);
  const run = async (): Promise<void> => {
    if (prev) await prev;
    await finalizeCompressionSummary(
      repos,
      conversationId,
      prevState,
      cutState,
      systemPromptSnapshot,
      model,
      homeAtSchedule,
    );
  };
  const p = run()
    .catch((e) => {
      getRuntimeLogger()
        .with({ component: "compression" })
        .error(`Conversation summary pipeline error: ${conversationId}`, {
          err: String(e),
        });
    })
    .finally(() => {
      if (pendingCompressionSummaries.get(conversationId) === p) {
        pendingCompressionSummaries.delete(conversationId);
      }
    });
  pendingCompressionSummaries.set(conversationId, p);
}
