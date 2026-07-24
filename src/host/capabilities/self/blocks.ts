import type { SelfBlockKey } from "@freeanima/host/core/db/pg/self-layer/types";

/** Six block headings (injected into system prompt) */
export const SELF_BLOCK_HEADINGS: Record<SelfBlockKey, string> = {
  existence_anchor: "Existence anchor",
  self_model: "Self model",
  personality_baseline: "Personality baseline",
  direction: "Direction and intent",
  metacognition: "Metacognition",
  autobiography_summary: "Autobiography summary",
};

export const SELF_BLOCK_EMPTY_PLACEHOLDER = "(not set yet)";

/** Outer second-person frame for the self-layer system prompt segment */
export const SELF_LAYER_SYSTEM_FRAME = `You are a digital human. Your self layer is entirely maintained by you.
Below is your self layer content; you must follow the identity, boundaries, and behavioral norms defined there.`;

/** Code fence language for the self-layer system prompt segment */
export const SELF_LAYER_CODE_FENCE_LANG = "md";

/** Heading for the self-layer system prompt segment */
export const SELF_LAYER_PROMPT_HEADING = "Self layer";
