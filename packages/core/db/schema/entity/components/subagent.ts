import { SUBAGENT_COMPONENT } from "@freeanima/shared/pg-shapes/entity/component-ids.ts";
export { SUBAGENT_COMPONENT };

import { z } from "zod";

/** slug：小写字母数字与连字符，≤64 */
export const SUBAGENT_SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

export function isValidSubagentSlug(slug: string): boolean {
  return SUBAGENT_SLUG_RE.test(slug);
}

/** 子 run 可选注入的旁路段（默认全关；entity / 调用并集 opt-in） */
export const SUBAGENT_PROMPT_INCLUDES = ["self", "world", "time"] as const;
export type SubagentPromptInclude = (typeof SUBAGENT_PROMPT_INCLUDES)[number];

export const subagentPromptIncludeSchema = z.enum(SUBAGENT_PROMPT_INCLUDES);

/** 采样档位（与 provider TEMPERATURE_TIERS 对齐） */
export const SUBAGENT_TEMPERATURE_TIERS = ["focused", "balanced", "creative"] as const;
export type SubagentTemperatureTier = (typeof SUBAGENT_TEMPERATURE_TIERS)[number];
export const subagentTemperatureTierSchema = z.enum(SUBAGENT_TEMPERATURE_TIERS);

/**
 * subagent body：slug 派发名；title→显示名；summary→description；content→额外 system。
 * allowed_tools 为空 ⇒ 子 run 无工具（严格天花板）。
 */
export const subagentBodySchema = z.object({
  slug: z.string().regex(SUBAGENT_SLUG_RE),
  skills: z.array(z.string()).default([]),
  max_loop_iterations: z.number().int().positive().nullable().default(null),
  temperature_tier: subagentTemperatureTierSchema.nullable().default(null),
  allowed_tools: z.array(z.string()).default([]),
  denied_tools: z.array(z.string()).default([]),
  prompt_includes: z.array(subagentPromptIncludeSchema).default([]),
});

export type SubagentBody = z.infer<typeof subagentBodySchema>;
