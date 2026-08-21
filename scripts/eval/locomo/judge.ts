import { completeText } from "./llm.ts";

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** dry-run / 启发式：gold 子串命中则 1，否则 0 */
export function heuristicJudge(prediction: string, gold: string): number {
  const g = normalize(gold);
  const p = normalize(prediction);
  if (!g) return prediction.trim() ? 0.5 : 0;
  if (!p) return 0;
  if (p.includes(g) || g.includes(p)) return 1;
  const gTokens = g.split(/[^a-z0-9\u4e00-\u9fff]+/).filter((t) => t.length > 1);
  if (gTokens.length === 0) return 0;
  const hit = gTokens.filter((t) => p.includes(t)).length;
  return hit / gTokens.length >= 0.5 ? 1 : 0;
}

export async function judgeAnswer(opts: {
  question: string;
  gold: string;
  prediction: string;
  dryRun: boolean;
  model?: string;
}): Promise<number> {
  if (opts.dryRun || !opts.prediction.trim()) {
    return heuristicJudge(opts.prediction, opts.gold);
  }
  const raw = await completeText({
    dryRun: false,
    system:
      "You are a strict QA grader. Reply with ONLY a number 0 or 1. " +
      "1 if the prediction correctly answers the question given the gold answer (paraphrase OK). " +
      "0 otherwise.",
    user: [
      `Question: ${opts.question}`,
      `Gold: ${opts.gold}`,
      `Prediction: ${opts.prediction}`,
      "Score:",
    ].join("\n"),
    ...(opts.model !== undefined ? { model: opts.model } : {}),
  });
  const m = raw.match(/([01](?:\.\d+)?)/);
  if (!m) return heuristicJudge(opts.prediction, opts.gold);
  const n = Number(m[1]);
  if (Number.isNaN(n)) return heuristicJudge(opts.prediction, opts.gold);
  return n >= 0.5 ? 1 : 0;
}
