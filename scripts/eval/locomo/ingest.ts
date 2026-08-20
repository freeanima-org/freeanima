import type { StoredMessage } from "@freeanima/habitat/core/db/domain";
import { getResolvedWorldContext } from "@freeanima/habitat/core/config/resolved-world-context";
import {
  appendMessageReturningId,
  upsertConversationMeta,
} from "@freeanima/habitat/core/db/pg/conversation";
import { formatCstIso } from "@freeanima/habitat/core/util";
import type { MemoryService } from "@freeanima/habitat/capabilities/memory/service";

import {
  createEvalMemoryHarness,
  flattenConversation,
  formatTranscript,
  ingestSampleMemory,
} from "./ingest-memory.ts";
import type { FlatTurn, LocomoSample } from "./types.ts";

export {
  createEvalMemoryHarness,
  flattenConversation,
  formatTranscript,
  recallLocal,
} from "./ingest-memory.ts";

export async function ingestSampleInMemory(opts: {
  sample: LocomoSample;
  harness: ReturnType<typeof createEvalMemoryHarness>;
}): Promise<{ conversationId: string; turns: FlatTurn[]; transcript: string; retained: number }> {
  return ingestSampleMemory(opts);
}

/** PG：messages 落库 → 同步 retain → 可供 hybrid FTS recall */
export async function ingestSamplePg(opts: {
  sample: LocomoSample;
  service: MemoryService;
}): Promise<{ conversationId: string; turns: FlatTurn[]; transcript: string; retained: number }> {
  const { sample, service } = opts;
  const conversationId = `locomo-${sample.sample_id}`;
  const turns = flattenConversation(sample);
  const transcript = formatTranscript(turns);
  const world = getResolvedWorldContext();

  await upsertConversationMeta(conversationId, {
    model: "locomo-eval",
    title: `LoCoMo ${sample.sample_id}`,
    timestamp: formatCstIso(),
    agent_subject_id: world.agent_subject_id,
    cached_toolsets: [],
    functions: [],
  });

  const bySession = new Map<string, FlatTurn[]>();
  for (const t of turns) {
    const list = bySession.get(t.sessionKey) ?? [];
    list.push(t);
    bySession.set(t.sessionKey, list);
  }

  let retained = 0;
  for (const [, sessionTurns] of bySession) {
    const message_ids: string[] = [];
    const texts: string[] = [];
    for (const t of sessionTurns) {
      const msg: StoredMessage = {
        role: "user",
        content: `${t.speaker}: ${t.text}`,
        timestamp: formatCstIso(),
        subject_id: world.user_subject_id,
      };
      const { messageId } = await appendMessageReturningId(conversationId, msg);
      message_ids.push(messageId);
      texts.push(msg.content);
    }
    await service.syncTurn({
      conversation_id: conversationId,
      message_ids,
      texts,
      trigger_retain: false,
    });
    const result = await service.retain({
      conversation_id: conversationId,
      message_ids,
      force: true,
    });
    retained += result.created.length;
  }

  return { conversationId, turns, transcript, retained };
}

/** 真召回：MemoryService.recall → hybrid FTS */
export async function recallHybrid(
  service: MemoryService,
  query: string,
  limit = 8,
): Promise<Array<{ id: number; content: string; score: number }>> {
  const { hits } = await service.recall({ query, scope: "semantic", limit });
  return hits.map((h) => ({ id: h.id, content: h.content, score: h.score }));
}
