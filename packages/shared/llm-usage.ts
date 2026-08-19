/** 供应商账单级用量合计（缓存入 / 未缓存入 / 出）。不含 tokenx 估算。 */

export type LlmUsageTotals = {
  cached_input_tokens: number;
  uncached_input_tokens: number;
  output_tokens: number;
};

export type RuntimeContextBreakdown = {
  system_self: number;
  system_agents: number;
  system_resident: number;
  system_toolsets: number;
  summary: number;
  messages: number;
  tools: number;
  total: number;
};

export type ConversationContextUsage = {
  used: number;
  window: number | null;
  breakdown: RuntimeContextBreakdown;
};

export function emptyLlmUsageTotals(): LlmUsageTotals {
  return { cached_input_tokens: 0, uncached_input_tokens: 0, output_tokens: 0 };
}

export function emptyRuntimeContextBreakdown(): RuntimeContextBreakdown {
  return {
    system_self: 0,
    system_agents: 0,
    system_resident: 0,
    system_toolsets: 0,
    summary: 0,
    messages: 0,
    tools: 0,
    total: 0,
  };
}

export function usageRecordToTotals(
  usage: Record<string, number> | null | undefined,
): LlmUsageTotals | null {
  if (!usage || typeof usage !== "object") return null;
  const prompt = usage.prompt_tokens;
  const completion = usage.completion_tokens;
  const cachedRaw = usage.cached_tokens;
  if (prompt == null && completion == null && cachedRaw == null) return null;
  const cached = typeof cachedRaw === "number" && Number.isFinite(cachedRaw) ? cachedRaw : 0;
  const promptN = typeof prompt === "number" && Number.isFinite(prompt) ? prompt : 0;
  const completionN =
    typeof completion === "number" && Number.isFinite(completion) ? completion : 0;
  return {
    cached_input_tokens: Math.max(0, cached),
    uncached_input_tokens: Math.max(0, promptN - Math.max(0, cached)),
    output_tokens: Math.max(0, completionN),
  };
}

export function addLlmUsageTotals(a: LlmUsageTotals, b: LlmUsageTotals): LlmUsageTotals {
  return {
    cached_input_tokens: a.cached_input_tokens + b.cached_input_tokens,
    uncached_input_tokens: a.uncached_input_tokens + b.uncached_input_tokens,
    output_tokens: a.output_tokens + b.output_tokens,
  };
}

export function sumUsageFromRecords(
  records: Array<Record<string, number> | null | undefined>,
): LlmUsageTotals {
  let acc = emptyLlmUsageTotals();
  for (const record of records) {
    const totals = usageRecordToTotals(record);
    if (totals) acc = addLlmUsageTotals(acc, totals);
  }
  return acc;
}

export function contextUsageRatio(used: number, window: number | null | undefined): number {
  if (window == null || window <= 0 || used <= 0) return 0;
  return Math.min(1, used / window);
}

/** k tokens display (1 decimal; raw count when <1000) */
export function formatTokenK(tokens: number): string {
  if (tokens <= 0) return "0";
  if (tokens < 1000) return `${Math.round(tokens)}`;
  const k = tokens / 1000;
  return k >= 10 ? `${Math.round(k)}k` : `${k.toFixed(1)}k`;
}

export function formatUsageTriplet(usage: LlmUsageTotals): string {
  return `缓存入 ${formatTokenK(usage.cached_input_tokens)} · 未缓存入 ${formatTokenK(usage.uncached_input_tokens)} · 出 ${formatTokenK(usage.output_tokens)}`;
}
