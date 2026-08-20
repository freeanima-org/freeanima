import { judgeAnswer } from "../judge.ts";
import { completeText, estimatePromptTokens } from "../llm.ts";
import type { ArmAnswer, LocomoQa, LocomoSample } from "../types.ts";

export async function answerBaseline(opts: {
  sample: LocomoSample;
  qa: LocomoQa;
  questionIndex: number;
  transcript: string;
  dryRun: boolean;
  model?: string;
}): Promise<ArmAnswer> {
  const { sample, qa, questionIndex, transcript, dryRun, model } = opts;
  const system =
    "Answer the question using ONLY the conversation transcript. Be concise. " +
    "If the answer is not present, say you don't know.";
  const user = `Transcript:\n${transcript}\n\nQuestion: ${qa.question}\nAnswer:`;
  const prompt = `${system}\n\n${user}`;
  const prompt_tokens = estimatePromptTokens(prompt, model);

  let prediction: string;
  if (dryRun) {
    // 冒烟：用 gold 作为「正确臂」假预测，便于指标非零
    prediction = qa.answer?.trim() ? qa.answer.trim() : "unknown";
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
    arm: "baseline",
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
