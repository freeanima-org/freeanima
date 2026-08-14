import { getActiveRuntimeConfig, resolvePassiveRecallConfig } from "@freeanima/habitat/core/config";
import { listResidentSemanticMemory } from "@freeanima/habitat/core/db/pg/semantic-memory";
import { isFtsQueryError } from "@freeanima/habitat/core/util";
import type { PassiveRecallDebugTrace } from "@freeanima/shared/rpc-contract/frames/message";

import { previewPassiveContent } from "./debug-types.ts";
import { formatPassiveMemoryBlock, wrapPassiveMemoryContext } from "./inject.ts";
import { focusPassiveRecallQuery, stripTimePrefixFromUserContent } from "./query.ts";
import { semanticPassiveRecallSearchDetailed } from "./search.ts";
import { classifyPassiveRecallNoHits } from "./skipped-reason.ts";

export type PassiveRecallDebugResult = {
  debug: PassiveRecallDebugTrace;
  inject_preview: string;
  enabled: boolean;
  limit: number;
  max_chars: number;
  exclude_resident: boolean;
};

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

/**
 * Operator dry-run of the passive semantic recall pipeline (does not mutate conversations).
 */
export async function runPassiveRecallDebug(opts: {
  user_text: string;
  limit?: number;
}): Promise<PassiveRecallDebugResult> {
  const config = resolvePassiveRecallConfig(getActiveRuntimeConfig().data);
  const limit = Math.max(1, Math.min(20, opts.limit ?? config.limit));
  const baseMeta = {
    enabled: config.enabled,
    limit,
    max_chars: config.max_chars,
    exclude_resident: config.exclude_resident,
  };

  if (!config.enabled) {
    return {
      ...baseMeta,
      debug: { ...emptyDebug(""), skipped_reason: "disabled" },
      inject_preview: "",
    };
  }

  const query = focusPassiveRecallQuery(stripTimePrefixFromUserContent(opts.user_text));
  if (!query) {
    return {
      ...baseMeta,
      debug: { ...emptyDebug(""), skipped_reason: "empty_query" },
      inject_preview: "",
    };
  }

  const started = performance.now();
  let hits;
  let debug: PassiveRecallDebugTrace;
  try {
    const result = await semanticPassiveRecallSearchDetailed(query, {
      limit,
      min_score: config.min_score,
      min_relative_score: config.min_relative_score,
      debug: true,
    });
    hits = result.hits;
    debug = result.debug ?? emptyDebug(query);
  } catch (e) {
    if (isFtsQueryError(e)) {
      return {
        ...baseMeta,
        debug: {
          ...emptyDebug(query),
          skipped_reason: "fts_query_error",
          elapsed_ms: Math.round(performance.now() - started),
        },
        inject_preview: "",
      };
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

  debug.after_resident_filter = hits.map((h) => ({
    id: h.semantic_memory_id,
    score: h.score,
    content_preview: previewPassiveContent(h.content),
  }));
  debug.excluded_resident_ids = excludedResidentIds;
  debug.elapsed_ms = Math.round(performance.now() - started);

  if (hits.length === 0) {
    debug.skipped_reason = classifyPassiveRecallNoHits(debug);
    return { ...baseMeta, debug, inject_preview: "" };
  }

  const block = formatPassiveMemoryBlock(hits, config.max_chars);
  const injectedIds = new Set([...block.matchAll(/\[\[anima:(\d+)\]\]/g)].map((m) => Number(m[1])));
  debug.injected = hits
    .filter((h) => injectedIds.has(h.semantic_memory_id))
    .map((h) => ({
      id: h.semantic_memory_id,
      score: h.score,
      content_preview: previewPassiveContent(h.content),
    }));

  return {
    ...baseMeta,
    debug,
    inject_preview: wrapPassiveMemoryContext(hits, config.max_chars),
  };
}
