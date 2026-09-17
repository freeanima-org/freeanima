import { sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { emptyLlmUsageTotals, type LlmUsageTotals } from "@freeanima/shared/llm-usage";

export function coerceLlmUsageTotals(row: {
  cached_input_tokens?: number | string | null;
  uncached_input_tokens?: number | string | null;
  output_tokens?: number | string | null;
}): LlmUsageTotals {
  return {
    cached_input_tokens: Number(row.cached_input_tokens ?? 0) || 0,
    uncached_input_tokens: Number(row.uncached_input_tokens ?? 0) || 0,
    output_tokens: Number(row.output_tokens ?? 0) || 0,
  };
}

export function emptyUsageTotals(): LlmUsageTotals {
  return emptyLlmUsageTotals();
}

/** JSONB payload.usage → 缓存入 / 未缓存入 / 出 */
export function llmUsageSumSelect(payloadCol: PgColumn) {
  return {
    cached_input_tokens: sql<number>`coalesce(sum(coalesce((${payloadCol}->'usage'->>'cached_tokens')::double precision, 0)), 0)::int`,
    uncached_input_tokens: sql<number>`coalesce(sum(greatest(0, coalesce((${payloadCol}->'usage'->>'prompt_tokens')::double precision, 0) - coalesce((${payloadCol}->'usage'->>'cached_tokens')::double precision, 0))), 0)::int`,
    output_tokens: sql<number>`coalesce(sum(coalesce((${payloadCol}->'usage'->>'completion_tokens')::double precision, 0)), 0)::int`,
  };
}
