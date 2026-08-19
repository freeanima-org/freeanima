import { describe, expect, it } from "bun:test";
import {
  addLlmUsageTotals,
  contextUsageRatio,
  emptyLlmUsageTotals,
  formatTokenK,
  formatUsageTriplet,
  sumUsageFromRecords,
  usageRecordToTotals,
} from "./llm-usage.ts";

describe("llm-usage", () => {
  it("splits cached vs uncached input from vendor usage", () => {
    expect(
      usageRecordToTotals({ prompt_tokens: 100, completion_tokens: 40, cached_tokens: 25 }),
    ).toEqual({
      cached_input_tokens: 25,
      uncached_input_tokens: 75,
      output_tokens: 40,
    });
  });

  it("treats missing cached as uncached-only", () => {
    expect(usageRecordToTotals({ prompt_tokens: 10, completion_tokens: 2 })).toEqual({
      cached_input_tokens: 0,
      uncached_input_tokens: 10,
      output_tokens: 2,
    });
  });

  it("returns null when usage has no token fields", () => {
    expect(usageRecordToTotals({})).toBeNull();
    expect(usageRecordToTotals(null)).toBeNull();
  });

  it("sums records and ignores empty ones", () => {
    const totals = sumUsageFromRecords([
      { prompt_tokens: 10, completion_tokens: 2, cached_tokens: 4 },
      null,
      { prompt_tokens: 5, completion_tokens: 1 },
    ]);
    expect(totals).toEqual({
      cached_input_tokens: 4,
      uncached_input_tokens: 11,
      output_tokens: 3,
    });
    expect(addLlmUsageTotals(emptyLlmUsageTotals(), totals)).toEqual(totals);
  });

  it("clamps context ratio and formats k", () => {
    expect(contextUsageRatio(0, 256_000)).toBe(0);
    expect(contextUsageRatio(128_000, 256_000)).toBe(0.5);
    expect(contextUsageRatio(300_000, 256_000)).toBe(1);
    expect(formatTokenK(0)).toBe("0");
    expect(formatTokenK(889)).toBe("889");
    expect(formatTokenK(11400)).toBe("11k");
    expect(formatTokenK(2600)).toBe("2.6k");
    expect(
      formatUsageTriplet({ cached_input_tokens: 25, uncached_input_tokens: 75, output_tokens: 40 }),
    ).toContain("缓存入");
  });
});
