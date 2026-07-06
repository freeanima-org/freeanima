/** Normalize vendor usage to stable fields (aligned with legacy llm.normalizeUsage) */
export function normalizeUsage(
  raw: Record<string, unknown> | null | undefined,
): Record<string, number> | null {
  if (!raw || typeof raw !== "object") return null;

  const prompt = raw.prompt_tokens ?? raw.input_tokens;
  const completion = raw.completion_tokens ?? raw.output_tokens;
  let cached = raw.cached_tokens ?? raw.cache_read_input_tokens;
  if (cached == null) {
    for (const key of ["prompt_tokens_details", "input_tokens_details"] as const) {
      const details = raw[key];
      if (
        details &&
        typeof details === "object" &&
        (details as Record<string, unknown>).cached_tokens != null
      ) {
        cached = (details as Record<string, unknown>).cached_tokens;
        break;
      }
    }
  }

  const out: Record<string, number> = {};
  if (prompt != null) out.prompt_tokens = Number(prompt);
  if (completion != null) out.completion_tokens = Number(completion);
  if (cached != null && typeof cached === "number") out.cached_tokens = cached;
  if (raw.total_tokens != null) out.total_tokens = Number(raw.total_tokens);
  return Object.keys(out).length > 0 ? out : null;
}
