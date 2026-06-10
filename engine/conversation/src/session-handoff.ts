import {
  generateSessionSummary,
  getL4,
  type GenerateSummaryResult,
} from "@freeanima/engine-compress";
import { isSessionMeta, parseCompressionState } from "@freeanima/engine-db/domain";
import type { PgRepositories } from "@freeanima/engine-repos";
import { load, loadSessionMeta } from "./conversation.ts";

/** /new etc.: read-only old session; generate handoff summary for new session (does not write old session) */
export async function generateSessionHandoffSummary(
  repos: PgRepositories,
  sessionId: string,
): Promise<GenerateSummaryResult> {
  const msgs = await load(repos, sessionId);
  const l4 = getL4(msgs);
  if (l4 === 0) {
    return { ok: false, error: "No conversation content" };
  }

  const meta = await loadSessionMeta(repos, sessionId);
  if (!isSessionMeta(meta)) {
    return { ok: false, error: "session does not exist" };
  }

  const prevState = parseCompressionState(meta.compression);
  const prevL2 = prevState?.l2 ?? 0;
  if (prevL2 >= l4 && prevState?.summary?.trim()) {
    return { ok: true, summary: prevState.summary.trim() };
  }

  const systemPrompt = meta.system_prompt ?? "";
  const model = meta.model;
  return generateSessionSummary(msgs, prevState, { l2: l4, l3: l4 }, systemPrompt, model);
}
