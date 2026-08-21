import {
  passiveRecallDebugBodySchema,
  semanticMemoryListBodySchema,
  semanticMemoryClustersBodySchema,
  semanticMemoryPinBodySchema,
  temporalSummaryListBodySchema,
  temporalSummaryRegenerateBodySchema,
  temporalSummaryBackfillMissingBodySchema,
  temporalSummaryRebuildRangeBodySchema,
  temporalSystemRollRegenerateBodySchema,
  temporalSystemRollBatchStartBodySchema,
  type PassiveRecallDebugBody,
  type SemanticMemoryListBody,
  type SemanticMemoryClustersBody,
  type SemanticMemoryPinBody,
  type TemporalSummaryListBody,
  type TemporalSummaryRegenerateBody,
  type TemporalSummaryBackfillMissingBody,
  type TemporalSummaryRebuildRangeBody,
  type TemporalSystemRollRegenerateBody,
  type TemporalSystemRollBatchStartBody,
} from "@freeanima/features/habitat/habitat/habitat-api/api";
import { habitatCtx } from "./runtime.ts";

export async function passiveRecallDebug(body: PassiveRecallDebugBody) {
  const parsed = passiveRecallDebugBodySchema.parse(body);
  return habitatCtx().passiveRecallDebug({
    user_text: parsed.user_text,
    ...(parsed.limit !== undefined ? { limit: parsed.limit } : {}),
  });
}

export async function listTemporalSummaries(body: TemporalSummaryListBody) {
  const parsed = temporalSummaryListBodySchema.parse(body);
  return habitatCtx().listTemporalSummaries({
    window: parsed.window,
    period_start_from: parsed.period_start_from?.trim() || undefined,
    period_start_to: parsed.period_start_to?.trim() || undefined,
    offset: parsed.offset,
    limit: parsed.limit,
    agent_subject_id: parsed.agent_subject_id,
  });
}

export async function regenerateTemporalSummary(body: TemporalSummaryRegenerateBody) {
  const parsed = temporalSummaryRegenerateBodySchema.parse(body);
  return habitatCtx().regenerateTemporalSummary({
    window: parsed.window,
    period_start: parsed.period_start,
  });
}

export async function backfillMissingTemporalSummaries(body: TemporalSummaryBackfillMissingBody) {
  const parsed = temporalSummaryBackfillMissingBodySchema.parse(body);
  return habitatCtx().backfillMissingTemporalSummaries({
    window: parsed.window,
    period_start_from: parsed.period_start_from,
    period_start_to: parsed.period_start_to,
  });
}

export async function rebuildTemporalSummariesInRange(body: TemporalSummaryRebuildRangeBody) {
  const parsed = temporalSummaryRebuildRangeBodySchema.parse(body);
  return habitatCtx().rebuildTemporalSummariesInRange({
    window: parsed.window,
    period_start_from: parsed.period_start_from,
    period_start_to: parsed.period_start_to,
  });
}

export function getTemporalBatchJobStatus() {
  return habitatCtx().getTemporalSummaryBatchJobStatus();
}

export async function listTemporalSystemRolls() {
  return habitatCtx().listTemporalSystemRolls();
}

export async function regenerateTemporalSystemRoll(body: TemporalSystemRollRegenerateBody) {
  const parsed = temporalSystemRollRegenerateBodySchema.parse(body);
  return habitatCtx().regenerateTemporalSystemRoll({ kind: parsed.kind });
}

export function startTemporalSystemRollBatch(body: TemporalSystemRollBatchStartBody = {}) {
  const parsed = temporalSystemRollBatchStartBodySchema.parse(body);
  return habitatCtx().startTemporalSystemRollBatch(
    parsed.kinds !== undefined ? { kinds: parsed.kinds } : {},
  );
}

export function getTemporalSystemRollBatchStatus() {
  return habitatCtx().getTemporalSystemRollBatchStatus();
}

export async function countSemanticMemory() {
  const { index_rows } = await habitatCtx().countSemanticMemory();
  return {
    ok: true as const,
    index_rows,
    code: "semantic_memory_count" as const,
    params: { count: String(index_rows) },
  };
}

export async function listSemanticMemories(body: SemanticMemoryListBody) {
  const parsed = semanticMemoryListBodySchema.parse(body);
  return habitatCtx().listSemanticMemories({
    query: parsed.query?.trim() || undefined,
    offset: parsed.offset,
    limit: parsed.limit,
    types: parsed.types,
    status: parsed.status,
    source_conversation: parsed.source_conversation?.trim() || undefined,
    sort_by: parsed.sort_by,
    cluster_id: parsed.cluster_id,
    agent_subject_id: parsed.agent_subject_id,
  });
}

export async function listSemanticMemoryClusters(_body: SemanticMemoryClustersBody = {}) {
  semanticMemoryClustersBodySchema.parse(_body ?? {});
  return habitatCtx().listSemanticMemoryClusters();
}

export async function updateSemanticMemoryPinned(body: SemanticMemoryPinBody) {
  const parsed = semanticMemoryPinBodySchema.parse(body);
  return habitatCtx().updateSemanticMemoryPinned(parsed.id, parsed.pinned);
}
