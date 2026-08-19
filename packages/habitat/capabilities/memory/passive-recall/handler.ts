import type { BeforeLlmCallContext } from "@freeanima/habitat/core/hooks/loop";
import {
  getActiveRuntimeConfig,
  getRuntimeLogger,
  resolvePassiveRecallConfig,
} from "@freeanima/habitat/core/config";
import { isCronSession } from "@freeanima/habitat/core/db/pg/conversation";
import { listResidentSemanticMemory } from "@freeanima/habitat/core/db/pg/semantic-memory";
import { isFtsQueryError } from "@freeanima/habitat/core/util";

import { parseRenderedMemoryIds } from "@freeanima/habitat/core/hooks/prompt";
import { previewPassiveContent, type PassiveRecallDebugTrace } from "./debug-types.ts";
import {
  formatPassiveMemoryBlock,
  manifestPassiveMemoryContext,
  stripPassiveMemoryContextFromMessages,
} from "./inject.ts";
import { focusPassiveRecallQuery, stripTimePrefixFromUserContent } from "./query.ts";
import { semanticPassiveRecallSearchDetailed } from "./search.ts";
import { classifyPassiveRecallNoHits } from "./skipped-reason.ts";

function emptyDebug(query: string): PassiveRecallDebugTrace {
  return {
    query,
    tsquery: null,
    effective_min_score: 0,
    min_score: 0,
    min_relative_score: 0,
    fts: [],
    trgm: [],
    merged: [],
    after_score_filter: [],
    after_resident_filter: [],
    excluded_resident_ids: [],
    injected: [],
    elapsed_ms: 0,
  };
}

function finishDebug(
  ctx: BeforeLlmCallContext,
  debug: PassiveRecallDebugTrace | undefined,
  patch?: Partial<PassiveRecallDebugTrace>,
): void {
  if (!ctx.llm_debug || !ctx.llmDebugExtras) return;
  ctx.llmDebugExtras.passive_recall = {
    ...(debug ?? emptyDebug(patch?.query ?? "")),
    ...patch,
  } satisfies PassiveRecallDebugTrace;
}

export function createPassiveMemoryRecallHandler() {
  return async (ctx: BeforeLlmCallContext): Promise<void> => {
    stripPassiveMemoryContextFromMessages(ctx.messages);

    const config = resolvePassiveRecallConfig(getActiveRuntimeConfig().data);
    if (!config.enabled) {
      finishDebug(ctx, undefined, { skipped_reason: "disabled", query: "" });
      return;
    }

    const lastMsg = ctx.messages.at(-1);
    if (!lastMsg || lastMsg.role !== "user") {
      finishDebug(ctx, undefined, { skipped_reason: "last_message_not_user", query: "" });
      return;
    }

    const conversationId = ctx.conversationId.trim();
    if (!conversationId) {
      finishDebug(ctx, undefined, { skipped_reason: "empty_conversation_id", query: "" });
      return;
    }

    if (await isCronSession(conversationId)) {
      finishDebug(ctx, undefined, { skipped_reason: "cron_session", query: "" });
      return;
    }

    const query = focusPassiveRecallQuery(stripTimePrefixFromUserContent(lastMsg.content));
    if (!query) {
      finishDebug(ctx, undefined, { skipped_reason: "empty_query", query: "" });
      return;
    }

    const started = performance.now();
    let hits;
    let debug: PassiveRecallDebugTrace | undefined;
    try {
      const result = await semanticPassiveRecallSearchDetailed(query, {
        limit: config.limit,
        min_score: config.min_score,
        min_relative_score: config.min_relative_score,
        debug: ctx.llm_debug === true,
      });
      hits = result.hits;
      debug = result.debug;
    } catch (e) {
      if (isFtsQueryError(e)) {
        finishDebug(ctx, debug, {
          query,
          skipped_reason: "fts_query_error",
          elapsed_ms: Math.round(performance.now() - started),
        });
        return;
      }
      throw e;
    }

    let excludedResidentIds: number[] = [];
    if (config.exclude_resident && hits.length > 0) {
      const resident = await listResidentSemanticMemory();
      const residentIds = new Set(resident.map((row) => row.id));
      const before = hits;
      hits = hits.filter((hit) => !residentIds.has(hit.semantic_memory_id));
      excludedResidentIds = before
        .filter((hit) => residentIds.has(hit.semantic_memory_id))
        .map((hit) => hit.semantic_memory_id);
    }

    if (debug) {
      debug.after_resident_filter = hits.map((h) => ({
        id: h.semantic_memory_id,
        score: h.score,
        content_preview: previewPassiveContent(h.content),
      }));
      debug.excluded_resident_ids = excludedResidentIds;
      debug.elapsed_ms = Math.round(performance.now() - started);
    }

    if (hits.length === 0) {
      finishDebug(ctx, debug, {
        query,
        skipped_reason: debug ? classifyPassiveRecallNoHits(debug) : "no_hits",
        elapsed_ms: Math.round(performance.now() - started),
      });
      return;
    }

    const block = formatPassiveMemoryBlock(hits, config.max_chars);
    const injectedIds = new Set(parseRenderedMemoryIds(block));
    if (debug) {
      debug.injected = hits
        .filter((h) => injectedIds.has(h.semantic_memory_id))
        .map((h) => ({
          id: h.semantic_memory_id,
          score: h.score,
          content_preview: previewPassiveContent(h.content),
        }));
    }

    manifestPassiveMemoryContext(ctx.messages, hits, config.max_chars);
    finishDebug(ctx, debug);

    getRuntimeLogger()
      .with({ component: "passive_recall", conversationId })
      .debug("injected passive semantic recall", {
        query,
        hits: hits.length,
        elapsed_ms: Math.round(performance.now() - started),
      });
  };
}
