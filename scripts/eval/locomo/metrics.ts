import {
  LOCOMO_CATEGORY_NAMES,
  type ArmAnswer,
  type CategoryMetrics,
  type LocomoReport,
} from "./types.ts";

function mean(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function sum(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0);
}

/** Token 节省率 = 1 - (FreeAnima / 基线)；基线为 0 时 null */
export function tokenSavingsRate(freeanimaTokens: number, baselineTokens: number): number | null {
  if (baselineTokens <= 0) return null;
  return 1 - freeanimaTokens / baselineTokens;
}

/** 质量保持率 = FreeAnima质量 / 基线质量；基线为 0 时 null */
export function qualityRetentionRate(
  freeanimaQuality: number,
  baselineQuality: number,
): number | null {
  if (baselineQuality <= 0) return null;
  return freeanimaQuality / baselineQuality;
}

function pairByQuestion(
  answers: ArmAnswer[],
): Map<string, { baseline?: ArmAnswer; freeanima?: ArmAnswer }> {
  const map = new Map<string, { baseline?: ArmAnswer; freeanima?: ArmAnswer }>();
  for (const a of answers) {
    const key = `${a.sample_id}#${a.question_index}`;
    const slot = map.get(key) ?? {};
    if (a.arm === "baseline") slot.baseline = a;
    else slot.freeanima = a;
    map.set(key, slot);
  }
  return map;
}

function aggregatePairRates(pairs: Array<{ baseline: ArmAnswer; freeanima: ArmAnswer }>): {
  token_savings_rate: number | null;
  quality_retention_rate: number | null;
  baseline_prompt_tokens: number;
  freeanima_prompt_tokens: number;
  baseline_quality: number;
  freeanima_quality: number;
} {
  const baseTok = pairs.map((p) => p.baseline.prompt_tokens);
  const faTok = pairs.map((p) => p.freeanima.prompt_tokens);
  const baseQ = pairs.map((p) => p.baseline.quality);
  const faQ = pairs.map((p) => p.freeanima.quality);
  const perQaSavings = pairs
    .map((p) => tokenSavingsRate(p.freeanima.prompt_tokens, p.baseline.prompt_tokens))
    .filter((x): x is number => x != null);
  const perQaRetention = pairs
    .map((p) => qualityRetentionRate(p.freeanima.quality, p.baseline.quality))
    .filter((x): x is number => x != null);

  return {
    token_savings_rate: perQaSavings.length > 0 ? mean(perQaSavings) : null,
    quality_retention_rate: perQaRetention.length > 0 ? mean(perQaRetention) : null,
    baseline_prompt_tokens: sum(baseTok),
    freeanima_prompt_tokens: sum(faTok),
    baseline_quality: mean(baseQ),
    freeanima_quality: mean(faQ),
  };
}

/** 从双臂答案聚合报告（按 QA 均值节省率 + 总量 token） */
export function buildReport(input: {
  answers: ArmAnswer[];
  dry_run: boolean;
  sample_ids: string[];
}): LocomoReport {
  const paired = pairByQuestion(input.answers);
  const complete: Array<{ baseline: ArmAnswer; freeanima: ArmAnswer }> = [];
  for (const slot of paired.values()) {
    if (slot.baseline && slot.freeanima) {
      complete.push({ baseline: slot.baseline, freeanima: slot.freeanima });
    }
  }

  const overall = aggregatePairRates(complete);
  const byCat = new Map<number, Array<{ baseline: ArmAnswer; freeanima: ArmAnswer }>>();
  for (const p of complete) {
    const cat = p.baseline.category;
    const list = byCat.get(cat) ?? [];
    list.push(p);
    byCat.set(cat, list);
  }

  const by_category: CategoryMetrics[] = [...byCat.entries()]
    .toSorted((a, b) => a[0] - b[0])
    .map(([category, pairs]) => {
      const agg = aggregatePairRates(pairs);
      const name =
        LOCOMO_CATEGORY_NAMES[category as keyof typeof LOCOMO_CATEGORY_NAMES] ?? `cat-${category}`;
      return {
        category,
        name,
        n: pairs.length,
        baseline_prompt_tokens: agg.baseline_prompt_tokens,
        freeanima_prompt_tokens: agg.freeanima_prompt_tokens,
        token_savings_rate: agg.token_savings_rate,
        baseline_quality: agg.baseline_quality,
        freeanima_quality: agg.freeanima_quality,
        quality_retention_rate: agg.quality_retention_rate,
      };
    });

  return {
    generated_at: new Date().toISOString(),
    dry_run: input.dry_run,
    sample_ids: input.sample_ids,
    qa_count: complete.length,
    answers: input.answers,
    overall,
    by_category,
  };
}
