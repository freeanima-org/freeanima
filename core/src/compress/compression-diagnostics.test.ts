import { describe, expect, it } from "bun:test";
import { formatCompressionDiagnostics } from "./compression-diagnostics.ts";

const cfg = { triggerHigh: 0.8, triggerLow: 0.6, maxRounds: 50 };

describe("formatCompressionDiagnostics", () => {
  it("shows token usage in token mode", () => {
    const lines = formatCompressionDiagnostics(
      {
        mode: "token",
        context_window: 1_000_000,
        context_window_source: "config",
        effective_budget: 991_808,
        usage_ratio: 0.42,
        threshold: 100,
        recompress_at: 200,
        window_raw: 10,
        messages_until_recompress: null,
        rounds_until_recompress: null,
        l3: 5,
        runtime_message_count: 20,
        stored_total: 100,
        hidden_by_compression: 80,
      },
      cfg,
    );
    expect(lines.some((l) => l.includes("Mode: token"))).toBe(true);
    expect(lines.some((l) => l.includes("source: config"))).toBe(true);
    expect(lines.some((l) => l.includes("42%"))).toBe(true);
    expect(lines.some((l) => l.includes("raw segment"))).toBe(false);
  });

  it("shows message thresholds in messages mode", () => {
    const lines = formatCompressionDiagnostics(
      {
        mode: "messages",
        context_window: null,
        context_window_source: null,
        effective_budget: null,
        usage_ratio: null,
        threshold: 100,
        recompress_at: 200,
        window_raw: 50,
        messages_until_recompress: 151,
        rounds_until_recompress: 76,
        l3: 10,
        runtime_message_count: 40,
        stored_total: 120,
        hidden_by_compression: 80,
      },
      cfg,
    );
    expect(lines.some((l) => l.includes("message-count fallback"))).toBe(true);
    expect(lines.some((l) => l.includes("raw segment 50/200"))).toBe(true);
    expect(lines.some((l) => l.includes("Until next trim"))).toBe(true);
  });
});
