import { z } from "zod";

/** System prompt assembly budgets (Habitat runtime `prompt` section). */
export const promptSchema = z.object({
  /** Global char budget after folding all sections; default applied in fold. */
  system_prompt_budget_chars: z.number().int().positive().optional(),
});

export type PromptConfigInput = z.infer<typeof promptSchema>;

export const DEFAULT_SYSTEM_PROMPT_BUDGET_CHARS = 14_000;
