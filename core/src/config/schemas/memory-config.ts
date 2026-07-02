import { z } from "zod";

import type { AnimaConfig } from "./config.ts";

export const passiveRecallConfigSchema = z.object({
  enabled: z.boolean().optional(),
  limit: z.number().int().positive().max(20).optional(),
  min_score: z.number().min(0).optional(),
  max_chars: z.number().int().positive().optional(),
  exclude_resident: z.boolean().optional(),
});

export const memoryConfigSchema = z
  .object({
    passive_recall: passiveRecallConfigSchema.optional(),
  })
  .passthrough();

export type PassiveRecallConfigInput = z.infer<typeof passiveRecallConfigSchema>;
export type MemoryConfigInput = z.infer<typeof memoryConfigSchema>;

export type ResolvedPassiveRecallConfig = {
  enabled: boolean;
  limit: number;
  min_score: number;
  max_chars: number;
  exclude_resident: boolean;
};

export function resolvePassiveRecallConfig(cfg: AnimaConfig): ResolvedPassiveRecallConfig {
  const raw = cfg.memory?.passive_recall as PassiveRecallConfigInput | undefined;
  return {
    enabled: raw?.enabled ?? true,
    limit: raw?.limit ?? 5,
    min_score: raw?.min_score ?? 0,
    max_chars: raw?.max_chars ?? 2000,
    exclude_resident: raw?.exclude_resident ?? true,
  };
}
