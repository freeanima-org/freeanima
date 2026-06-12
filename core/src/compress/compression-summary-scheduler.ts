import type { PgRepositories } from "@freeanima/core/repos";
import { formatCstIso } from "@freeanima/core/util";
import type { CompressionState } from "@freeanima/core/db/domain";
import { getRuntimeLogger } from "@freeanima/core/config";
import { generateSessionSummary } from "./compression-summary.ts";

export type CompressionSummaryPostCut = (repos: PgRepositories, session: string) => Promise<void>;

let postCutRebuild: CompressionSummaryPostCut | null = null;

export function registerCompressionSummaryPostCut(fn: CompressionSummaryPostCut): void {
  postCutRebuild = fn;
}

export function resetCompressionSummaryPostCutForTests(): void {
  postCutRebuild = null;
}

const pendingCompressionSummaries = new Map<string, Promise<void>>();

/** Await in-flight async session summaries (integration teardown must call before restoring FREEANIMA_HOME) */
export async function flushCompressionSummaries(
  _repos: PgRepositories,
  session?: string,
): Promise<void> {
  if (session !== undefined) {
    const p = pendingCompressionSummaries.get(session);
    if (p) await p;
    return;
  }
  await Promise.all([...pendingCompressionSummaries.values()]);
}

async function patchSessionCompression(
  repos: PgRepositories,
  session: string,
  compression: CompressionState,
): Promise<void> {
  if (!repos.pgAvailable) return;
  await repos.session.patchSessionMeta(session, { compression });
}

async function finalizeCompressionSummary(
  repos: PgRepositories,
  session: string,
  prevState: CompressionState | null,
  cutState: CompressionState,
  systemPromptSnapshot: string,
  model: string,
  homeAtSchedule: string,
): Promise<void> {
  if ((process.env.FREEANIMA_HOME ?? "") !== homeAtSchedule) {
    getRuntimeLogger()
      .with({ component: "compression" })
      .warn(`Skipping session summary (FREEANIMA_HOME changed): ${session}`);
    return;
  }
  const prevL2 = prevState?.l2 ?? null;
  const fromPos = (prevL2 ?? 0) + 1;
  const slice = repos.pgAvailable
    ? await repos.session.listMessagesByPosRange(session, fromPos, cutState.l2)
    : [];

  const gen = await generateSessionSummary(
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
      .error(`Session summary generation failed: ${session}`, {
        err: gen.error,
      });
  }

  await patchSessionCompression(repos, session, merged);
  if (postCutRebuild) {
    try {
      await postCutRebuild(repos, session);
    } catch (e) {
      getRuntimeLogger()
        .with({ component: "compression" })
        .error(`Failed to rebuild system_prompt after compression: ${session}`, { err: String(e) });
    }
  }
}

/** Schedule async summary generation when compression boundaries change */
export function scheduleCompressionSummary(
  repos: PgRepositories,
  session: string,
  prevState: CompressionState | null,
  cutState: CompressionState,
  systemPromptSnapshot: string,
  model: string,
): void {
  const homeAtSchedule = process.env.FREEANIMA_HOME ?? "";
  const prev = pendingCompressionSummaries.get(session);
  const run = async (): Promise<void> => {
    if (prev) await prev;
    await finalizeCompressionSummary(
      repos,
      session,
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
        .error(`Session summary pipeline error: ${session}`, {
          err: String(e),
        });
    })
    .finally(() => {
      if (pendingCompressionSummaries.get(session) === p) {
        pendingCompressionSummaries.delete(session);
      }
    });
  pendingCompressionSummaries.set(session, p);
}
