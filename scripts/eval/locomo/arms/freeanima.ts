import type { MemoryService } from "@freeanima/habitat/capabilities/memory/service";

import { recallHybrid, recallLocal } from "../ingest.ts";
import { judgeAnswer } from "../judge.ts";
import { completeText, estimatePromptTokens } from "../llm.ts";
import type { ArmAnswer, LocomoQa, LocomoSample } from "../types.ts";

export async function answerFreeanima(opts: {
  sample: LocomoSample;
  qa: LocomoQa;
  questionIndex: number;
  service: MemoryService;
  dryRun: boolean;
  /** true：MemoryService.recall（hybrid FTS）；false：关键词 list */
  realRecall: boolean;
  model?: string;
  recallLimit?: number;
}): Promise<ArmAnswer> {
  const { sample, qa, questionIndex, service, dryRun, model, realRecall } = opts;
  const hits = realRecall
    ? await recallHybrid(service, qa.question, opts.recallLimit ?? 8)
    : await recallLocal(service, qa.question, opts.recallLimit ?? 8);
  const memoryBlock =
    hits.length > 0
      ? hits.map((h, i) => `${i + 1}. ${h.content}`).join("\n")
      : "(no memories recalled)";

  const system =
    "Answer the question using ONLY the recalled memories. Be concise. " +
    "If the answer is not present, say you don't know.";
  const user = `Memories:\n${memoryBlock}\n\nQuestion: ${qa.question}\nAnswer:`;
  const prompt = `${system}\n\n${user}`;
  const prompt_tokens = estimatePromptTokens(prompt, model);

  let prediction: string;
  if (dryRun) {
    const gold = qa.answer?.trim() ?? "";
    const joined = hits
      .map((h) => h.content)
      .join(" ")
      .toLowerCase();
    if (gold && joined.includes(gold.toLowerCase().slice(0, Math.min(12, gold.length)))) {
      prediction = gold;
    } else if (hits[0]) {
      prediction = hits[0].content.slice(0, 120);
    } else {
      prediction = "unknown";
    }
  } else {
    prediction = await completeText({
      dryRun: false,
      system,
      user,
      ...(model !== undefined ? { model } : {}),
    });
  }

  const quality = await judgeAnswer({
    question: qa.question,
    gold: qa.answer ?? "",
    prediction,
    dryRun,
    ...(model !== undefined ? { model } : {}),
  });

  return {
    arm: "freeanima",
    sample_id: sample.sample_id,
    question_index: questionIndex,
    category: qa.category,
    question: qa.question,
    gold_answer: qa.answer ?? "",
    prediction,
    prompt_tokens,
    quality,
    dry_run: dryRun,
  };
}
