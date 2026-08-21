/** LoCoMo Eval Adapter 类型（风巢 #16041） */

export const LOCOMO_CATEGORY_NAMES = {
  1: "single-hop",
  2: "temporal",
  3: "multi-hop",
  4: "open-ended",
  5: "adversarial",
} as const;

export type LocomoCategoryId = keyof typeof LOCOMO_CATEGORY_NAMES;

export type LocomoTurn = {
  speaker: string;
  dia_id: string;
  text: string;
  blip_caption?: string;
  img_url?: string;
};

export type LocomoQa = {
  question: string;
  answer?: string;
  category: number;
  evidence?: string[];
};

export type LocomoSample = {
  sample_id: string;
  conversation: Record<string, unknown>;
  qa: LocomoQa[];
};

export type FlatTurn = {
  sessionKey: string;
  sessionDateTime?: string;
  dia_id: string;
  speaker: string;
  text: string;
};

export type ArmName = "baseline" | "freeanima";

export type ArmAnswer = {
  arm: ArmName;
  sample_id: string;
  question_index: number;
  category: number;
  question: string;
  gold_answer: string;
  prediction: string;
  prompt_tokens: number;
  quality: number;
  dry_run: boolean;
};

export type CategoryMetrics = {
  category: number;
  name: string;
  n: number;
  baseline_prompt_tokens: number;
  freeanima_prompt_tokens: number;
  token_savings_rate: number | null;
  baseline_quality: number;
  freeanima_quality: number;
  quality_retention_rate: number | null;
};

export type LocomoReport = {
  generated_at: string;
  dry_run: boolean;
  sample_ids: string[];
  qa_count: number;
  answers: ArmAnswer[];
  overall: {
    token_savings_rate: number | null;
    quality_retention_rate: number | null;
    baseline_prompt_tokens: number;
    freeanima_prompt_tokens: number;
    baseline_quality: number;
    freeanima_quality: number;
  };
  by_category: CategoryMetrics[];
};
