import { PROFILE_SKILL_REVIEW as PROFILE_SKILL_REVIEW_ID } from "@freeanima/host/core/provider";

/** Builtin meta-skill: curation rules; bypass hard-injects its body. */
export const SKILL_CURATION_NAME = "skill-curation" as const;

/** LLM profile for skill evolve / maintain bypass (falls back to default). */
export const PROFILE_SKILL_REVIEW = PROFILE_SKILL_REVIEW_ID;

export const SKILL_REVIEW_RUN_KIND_EVOLVE = "skill-evolve" as const;
export const SKILL_REVIEW_RUN_KIND_MAINTAIN = "skill-maintain" as const;

/** Post-turn evolve gate: min successful-or-any tool calls in the last turn. */
export const SKILL_EVOLVE_MIN_TOOL_CALLS = 5;

/** Short tool loop budget for skill review AutoLlmRun. */
export const SKILL_REVIEW_MAX_TURNS = 10;

/** Tools allowed inside skill review bypass (Capability Policy allow list). */
export const SKILL_REVIEW_TOOL_NAMES = [
  "skill_list",
  "skill_search",
  "skill_view",
  "skill_load",
  "skill_create",
  "skill_patch",
  "skill_update",
  "skill_delete",
  "skill_export",
] as const;

export type SkillReviewMode = "evolve" | "maintain";

export const SKILL_WRITE_TOOL_NAMES = new Set([
  "skill_create",
  "skill_patch",
  "skill_update",
  "skill_delete",
  "skill_import",
]);
