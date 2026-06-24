import type { CompressionAnalysis } from "./compressor.ts";
import type { ResolvedCompressionConfig } from "./compression-config.ts";

export function formatTokenK(tokens: number): string {
  if (tokens >= 1_000_000) return `${Math.round(tokens / 100_000) / 10}M`;
  if (tokens >= 1000) return `${Math.round(tokens / 100) / 10}K`;
  return String(tokens);
}

export function formatCompressionPct(ratio: number | null): string {
  if (ratio == null) return "—";
  return `${Math.round(ratio * 1000) / 10}%`;
}

export type CompressionDiagnosticsInput = Pick<
  CompressionAnalysis,
  | "mode"
  | "context_window"
  | "context_window_source"
  | "effective_budget"
  | "usage_ratio"
  | "threshold"
  | "recompress_at"
  | "window_raw"
  | "messages_until_recompress"
  | "rounds_until_recompress"
  | "l3"
  | "runtime_message_count"
  | "stored_total"
  | "hidden_by_compression"
>;

export type CompressionDiagnosticsConfig = Pick<
  ResolvedCompressionConfig,
  "triggerHigh" | "triggerLow" | "maxRounds"
>;

/** Mode-aware compression status lines for /compress and /stats */
export function formatCompressionDiagnostics(
  analysis: CompressionDiagnosticsInput,
  cfg: CompressionDiagnosticsConfig,
  opts?: {
    /** When true, include stored/runtime/hidden summary (for /compress) */
    includeStorageSummary?: boolean;
    /** Total archive count when different from analysis.stored_total */
    archiveTotal?: number;
  },
): string[] {
  const lines: string[] = [];

  if (analysis.mode === "token") {
    const win = analysis.context_window;
    const budget = analysis.effective_budget;
    const source = analysis.context_window_source ?? "unknown";
    lines.push(
      `Mode: token (window ${win != null ? formatTokenK(win) : "—"}, budget ${budget != null ? formatTokenK(budget) : "—"}, source: ${source})`,
    );
    lines.push(
      `Usage: ${formatCompressionPct(analysis.usage_ratio)} (trigger ≥${formatCompressionPct(cfg.triggerLow)} / tool-loop ≥${formatCompressionPct(cfg.triggerHigh)})`,
    );
  } else {
    lines.push(`Mode: message-count fallback (max_rounds=${cfg.maxRounds})`);
    lines.push(
      `Trigger: first >${analysis.threshold} messages, recompress window >${analysis.recompress_at} messages`,
    );
    lines.push(
      `raw segment ${analysis.window_raw}/${analysis.recompress_at} (first threshold ${analysis.threshold})`,
    );
  }

  if (opts?.includeStorageSummary) {
    const archive = opts.archiveTotal ?? analysis.stored_total;
    lines.push(
      `stored ${archive} → runtime ${analysis.runtime_message_count} (hidden ${analysis.hidden_by_compression})`,
    );
  }

  if (analysis.l3 == null) {
    return lines;
  }

  if (analysis.mode === "messages") {
    if (analysis.messages_until_recompress != null) {
      lines.push(
        `Until next trim: ~${analysis.messages_until_recompress} messages (~${analysis.rounds_until_recompress} turns)`,
      );
    } else if (analysis.window_raw > analysis.recompress_at) {
      lines.push("Until next trim: threshold reached; next beginTurn will advance l2/l3");
    }
  } else if (analysis.usage_ratio != null && analysis.usage_ratio >= cfg.triggerHigh) {
    lines.push("Until next compress: usage at cap; next beginTurn will advance l2/l3");
  } else if (analysis.usage_ratio != null && analysis.usage_ratio < cfg.triggerLow) {
    lines.push("Until next compress: usage below hysteresis floor; boundary not advanced yet");
  }

  return lines;
}
