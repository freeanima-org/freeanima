import type { BeforeLlmCallContext } from "@freeanima/core/hooks/loop";
import {
  getActiveRuntimeConfig,
  getRuntimeLogger,
  resolvePassiveRecallConfig,
} from "@freeanima/core/config";
import { isCronSession } from "@freeanima/core/db/pg/conversation";
import { listResidentSemanticMemory } from "@freeanima/core/db/pg/semantic-memory";
import { RESIDENT_TOP_N } from "@freeanima/core/db/pg/semantic-memory/types";
import { isFtsQueryError } from "@freeanima/core/util";

import { manifestPassiveMemoryContext, stripPassiveMemoryContextFromMessages } from "./inject.ts";
import { focusPassiveRecallQuery, stripTimePrefixFromUserContent } from "./query.ts";
import { semanticPassiveRecallSearch } from "./search.ts";

export function createPassiveMemoryRecallHandler() {
  return async (ctx: BeforeLlmCallContext): Promise<void> => {
    stripPassiveMemoryContextFromMessages(ctx.messages);

    const config = resolvePassiveRecallConfig(getActiveRuntimeConfig().data);
    if (!config.enabled) return;

    const lastMsg = ctx.messages.at(-1);
    if (!lastMsg || lastMsg.role !== "user") return;

    const conversationId = ctx.conversationId.trim();
    if (!conversationId) return;

    if (await isCronSession(conversationId)) return;

    const query = focusPassiveRecallQuery(stripTimePrefixFromUserContent(lastMsg.content));
    if (!query) return;

    const started = performance.now();
    let hits;
    try {
      hits = await semanticPassiveRecallSearch(query, {
        limit: config.limit,
        min_score: config.min_score,
        min_relative_score: config.min_relative_score,
      });
    } catch (e) {
      if (isFtsQueryError(e)) return;
      throw e;
    }

    if (config.exclude_resident && hits.length > 0) {
      const resident = await listResidentSemanticMemory(RESIDENT_TOP_N);
      const residentIds = new Set(resident.map((row) => row.id));
      hits = hits.filter((hit) => !residentIds.has(hit.semantic_memory_id));
    }

    if (hits.length === 0) return;

    manifestPassiveMemoryContext(ctx.messages, hits, config.max_chars);

    getRuntimeLogger()
      .with({ component: "passive_recall", conversationId })
      .debug("injected passive semantic recall", {
        query,
        hits: hits.length,
        elapsed_ms: Math.round(performance.now() - started),
      });
  };
}
