import { describe, expect, test } from "bun:test";

import { parseLocomoData } from "./fetch-data.ts";
import { buildReport, qualityRetentionRate, tokenSavingsRate } from "./metrics.ts";
import type { ArmAnswer } from "./types.ts";

describe("locomo metrics", () => {
  test("tokenSavingsRate / qualityRetentionRate", () => {
    expect(tokenSavingsRate(40, 100)).toBeCloseTo(0.6);
    expect(tokenSavingsRate(10, 0)).toBeNull();
    expect(qualityRetentionRate(0.8, 1)).toBeCloseTo(0.8);
    expect(qualityRetentionRate(0.5, 0)).toBeNull();
  });

  test("buildReport aggregates paired arms", () => {
    const answers: ArmAnswer[] = [
      {
        arm: "baseline",
        sample_id: "s1",
        question_index: 0,
        category: 1,
        question: "q",
        gold_answer: "a",
        prediction: "a",
        prompt_tokens: 100,
        quality: 1,
        dry_run: true,
      },
      {
        arm: "freeanima",
        sample_id: "s1",
        question_index: 0,
        category: 1,
        question: "q",
        gold_answer: "a",
        prediction: "a",
        prompt_tokens: 40,
        quality: 0.8,
        dry_run: true,
      },
    ];
    const report = buildReport({ answers, dry_run: true, sample_ids: ["s1"] });
    expect(report.qa_count).toBe(1);
    expect(report.overall.token_savings_rate).toBeCloseTo(0.6);
    expect(report.overall.quality_retention_rate).toBeCloseTo(0.8);
    expect(report.by_category).toHaveLength(1);
    expect(report.by_category[0]?.name).toBe("single-hop");
  });
});

describe("parseLocomoData", () => {
  test("parses fixture-shaped JSON", () => {
    const samples = parseLocomoData([
      {
        sample_id: "x",
        conversation: { session_1: [{ speaker: "A", dia_id: "1", text: "hi" }] },
        qa: [{ question: "q?", answer: "a", category: 1 }],
      },
    ]);
    expect(samples).toHaveLength(1);
    expect(samples[0]?.qa[0]?.category).toBe(1);
  });
});
