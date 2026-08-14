import { z } from "zod";

import { isEmbeddingEnabled } from "../embedding-helpers.ts";
import type { RuntimeConfig } from "./runtime-config.ts";

export const passiveRecallConfigSchema = z.object({
  enabled: z.boolean().optional(),
  limit: z.number().int().positive().max(20).optional(),
  min_score: z.number().min(0).optional(),
  min_relative_score: z.number().min(0).max(1).optional(),
  max_chars: z.number().int().positive().optional(),
  exclude_resident: z.boolean().optional(),
  /**
   * When true (and embedding configured), passive recall RRF-includes vector as boost-only.
   * Default: true when embedding is enabled.
   */
  use_vector: z.boolean().optional(),
});

/** embedded = 同进程；remote = 同契约外置（#16102）；非多 Provider 插件 */
export const memoryDeploymentSchema = z.enum(["embedded", "remote"]);

export const memoryCutoverConfigSchema = z.object({
  /** 停 light-sleep / deep-sleep 生产路径；改走 retain/reflect */
  disable_sleep_consolidation: z.boolean().optional(),
  /** limbic / dream / narrative 停写 */
  park_limbic_dream_narrative: z.boolean().optional(),
});

export const memoryConfigSchema = z
  .object({
    /** 默认 embedded；remote 客户端实现同 MemoryService 契约 */
    deployment: memoryDeploymentSchema.optional(),
    /** #16102 cutover；缺省停写 limbic/dream 且停浅深睡巩固（可显式 false 回滚标志位） */
    cutover: memoryCutoverConfigSchema.optional(),
    passive_recall: passiveRecallConfigSchema.optional(),
    temporal_summary: z
      .object({
        enabled: z.boolean().optional(),
        chunk_max_chars: z.number().int().positive().optional(),
        peer_roll_max_chars: z.number().int().positive().optional(),
        global_day_max_chars: z.number().int().positive().optional(),
        month_max_chars: z.number().int().positive().optional(),
        year_max_chars: z.number().int().positive().optional(),
        system_prompt_max_chars: z.number().int().positive().optional(),
        redis_key_prefix: z.string().optional(),
        peer_roll_ttl_seconds: z.number().int().positive().optional(),
      })
      .optional(),
  })
  .passthrough();

export type PassiveRecallConfigInput = z.infer<typeof passiveRecallConfigSchema>;
export type MemoryConfigInput = z.infer<typeof memoryConfigSchema>;
export type MemoryDeploymentConfig = z.infer<typeof memoryDeploymentSchema>;
export type MemoryCutoverConfigInput = z.infer<typeof memoryCutoverConfigSchema>;

export function resolveMemoryDeployment(cfg: RuntimeConfig): MemoryDeploymentConfig {
  return cfg.memory?.deployment ?? "embedded";
}

export type MemoryCutoverFlags = {
  disable_sleep_consolidation: boolean;
  park_limbic_dream_narrative: boolean;
};

/** #16102：park 与停浅/深睡默认开；可显式 false 回滚到 sleep-cycle 巩固 */
export function resolveMemoryCutoverFlags(cfg?: RuntimeConfig | null): MemoryCutoverFlags {
  const raw = cfg?.memory?.cutover;
  return {
    disable_sleep_consolidation: raw?.disable_sleep_consolidation ?? true,
    park_limbic_dream_narrative: raw?.park_limbic_dream_narrative ?? true,
  };
}

export type ResolvedPassiveRecallConfig = {
  enabled: boolean;
  limit: number;
  min_score: number;
  min_relative_score: number;
  max_chars: number;
  exclude_resident: boolean;
  use_vector: boolean;
};

/** RRF rank-1 single-channel ≈ 1/61; require at least weak single-channel relevance */
export const DEFAULT_PASSIVE_RECALL_MIN_SCORE = 0.016;

/** Keep hits within this fraction of the top hybrid score */
export const DEFAULT_PASSIVE_RECALL_MIN_RELATIVE_SCORE = 0.55;

export function resolvePassiveRecallConfig(cfg: RuntimeConfig): ResolvedPassiveRecallConfig {
  const raw = cfg.memory?.passive_recall;
  const embeddingOn = isEmbeddingEnabled(cfg);
  return {
    enabled: raw?.enabled ?? true,
    limit: raw?.limit ?? 5,
    min_score: raw?.min_score ?? DEFAULT_PASSIVE_RECALL_MIN_SCORE,
    min_relative_score: raw?.min_relative_score ?? DEFAULT_PASSIVE_RECALL_MIN_RELATIVE_SCORE,
    max_chars: raw?.max_chars ?? 2000,
    exclude_resident: raw?.exclude_resident ?? true,
    use_vector: raw?.use_vector ?? embeddingOn,
  };
}
