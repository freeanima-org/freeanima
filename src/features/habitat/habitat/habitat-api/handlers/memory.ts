import {
  autobiographicalMemoryListBodySchema,
  limbicMemoryListBodySchema,
  passiveRecallDebugBodySchema,
  semanticMemoryListBodySchema,
  semanticMemoryPinBodySchema,
  temporalSummaryListBodySchema,
  temporalSummaryRegenerateBodySchema,
  temporalSummaryBackfillMissingBodySchema,
  temporalSystemRollRegenerateBodySchema,
  type AutobiographicalMemoryListBody,
  type LimbicMemoryListBody,
  type PassiveRecallDebugBody,
  type SemanticMemoryListBody,
  type SemanticMemoryPinBody,
  type TemporalSummaryListBody,
  type TemporalSummaryRegenerateBody,
  type TemporalSummaryBackfillMissingBody,
  type TemporalSystemRollRegenerateBody,
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

export async function listTemporalSystemRolls() {
  return habitatCtx().listTemporalSystemRolls();
}

export async function regenerateTemporalSystemRoll(body: TemporalSystemRollRegenerateBody) {
  const parsed = temporalSystemRollRegenerateBodySchema.parse(body);
  return habitatCtx().regenerateTemporalSystemRoll({ kind: parsed.kind });
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
  });
}

export async function listLimbicMemories(body: LimbicMemoryListBody) {
  const parsed = limbicMemoryListBodySchema.parse(body);
  return habitatCtx().listLimbicMemories({
    query: parsed.query?.trim() || undefined,
    offset: parsed.offset,
    limit: parsed.limit,
    conversation_id: parsed.conversation_id?.trim() || undefined,
    kind: parsed.kind,
  });
}

export async function listAutobiographicalMemories(body: AutobiographicalMemoryListBody) {
  const parsed = autobiographicalMemoryListBodySchema.parse(body);
  return habitatCtx().listAutobiographicalMemories({
    query: parsed.query?.trim() || undefined,
    offset: parsed.offset,
    limit: parsed.limit,
    status: parsed.status,
    significance: parsed.significance,
    source_conversation: parsed.source_conversation?.trim() || undefined,
  });
}

export async function updateSemanticMemoryPinned(body: SemanticMemoryPinBody) {
  const parsed = semanticMemoryPinBodySchema.parse(body);
  return habitatCtx().updateSemanticMemoryPinned(parsed.id, parsed.pinned);
}
