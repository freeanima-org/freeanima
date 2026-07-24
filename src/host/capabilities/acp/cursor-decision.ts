/** Cursor blocking interaction (ask_question / create_plan) capture for LLM decision in prompt result */

export type CursorQuestionOption = {
  id: string;
  label: string;
};

export type CursorQuestion = {
  id: string;
  prompt: string;
  options: CursorQuestionOption[];
};

export type CursorPendingQuestions = {
  kind: "questions";
  questions: CursorQuestion[];
};

export type CursorPendingPlan = {
  kind: "plan";
  plan: string;
  planUri?: string;
};

export type CursorPendingInteraction = CursorPendingQuestions | CursorPendingPlan;

export type PromptCapture = {
  pending: CursorPendingInteraction[];
  notes: string[];
};

export function createPromptCapture(): PromptCapture {
  return { pending: [], notes: [] };
}

export function parseCursorQuestions(params: Record<string, unknown>): CursorQuestion[] {
  const raw = params.questions;
  if (!Array.isArray(raw)) return [];
  const out: CursorQuestion[] = [];
  for (const q of raw) {
    if (!q || typeof q !== "object") continue;
    const row = q as Record<string, unknown>;
    const id = String(row.id ?? "").trim();
    const prompt = String(row.prompt ?? row.text ?? row.question ?? "").trim();
    if (!id || !prompt) continue;
    const options: CursorQuestionOption[] = [];
    const rawOpts = row.options;
    if (Array.isArray(rawOpts)) {
      for (const opt of rawOpts) {
        if (!opt || typeof opt !== "object") continue;
        const o = opt as Record<string, unknown>;
        const optId = String(o.id ?? "").trim();
        const label = String(o.label ?? o.text ?? optId).trim();
        if (optId) options.push({ id: optId, label });
      }
    }
    out.push({ id, prompt, options });
  }
  return out;
}

export function parseCursorPlan(params: Record<string, unknown>): string {
  const plan = params.plan;
  if (typeof plan === "string" && plan.trim()) return plan.trim();
  const content = params.content;
  if (typeof content === "string" && content.trim()) return content.trim();
  return "";
}
