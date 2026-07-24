import type { CronLogAppendInput } from "@freeanima/host/core/db/pg/cron";
import { appendCronLog } from "@freeanima/host/core/db/pg/cron";
import { formatCstIso } from "@freeanima/host/core/util";

const ERROR_MAX = 2000;
const OUTPUT_TEXT_MAX = 10_000;

function tryParseOutputJson(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function appendCronRunLog(input: {
  job_id: string;
  run_count: number;
  ok: boolean;
  outputText: string;
  error?: string;
}): Promise<void> {
  const row: CronLogAppendInput = {
    job_id: input.job_id,
    run_count: input.run_count,
    ok: input.ok,
    finished_at: formatCstIso(),
  };

  if (input.ok) {
    const parsed = tryParseOutputJson(input.outputText);
    if (parsed) {
      row.output = parsed;
    } else if (input.outputText.trim()) {
      row.output_text = input.outputText.slice(0, OUTPUT_TEXT_MAX);
    }
  } else {
    const err = (input.error ?? input.outputText).trim();
    if (err) row.error = err.slice(0, ERROR_MAX);
  }

  await appendCronLog(row);
}
