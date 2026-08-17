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

/** 语义记忆向量聚类（reflect 分批）；默认在 embedding 开启时启用 */
export const memoryClusteringConfigSchema = z.object({
  enabled: z.boolean().optional(),
  /**
   * 仅增量：新记忆并入「已有族」的余弦距离上限（全量 HDBSCAN 不用）。
   * 越小越严；过大易把不相干并入。
   */
  eps: z.number().positive().optional(),
  /** 全量 HDBSCAN min_cluster_size（配置键历史名 min_points） */
  min_points: z.number().int().positive().optional(),
  /** 核心距离邻域点数；默认 min_points-1 */
  min_samples: z.number().int().positive().optional(),
  /**
   * 全量校准时是否剥落「不够大的一侧」。
   * false（默认）少未分组；true 簇更纯、未分组更多。不做噪声事后挂靠。
   */
  peel_small: z.boolean().optional(),
  /** 单 batch 喂给 reflect 的 JSON 字节上限 */
  max_batch_bytes: z.number().int().positive().optional(),
  /** 全量聚类校准条数上限（保护小规格机器） */
  max_calibrate_n: z.number().int().positive().optional(),
});

export const memoryResidentConfigSchema = z.object({
  /** 常驻注入条数上限（含非置顶热度槽） */
  top_n: z.number().int().positive().max(100).optional(),
  /** 置顶常驻硬上限；超限截断列表并 warn，不写库 unpin */
  pinned_max: z.number().int().positive().max(200).optional(),
});

export const memoryReferenceConfigSchema = z.object({
  decay_days: z.number().int().positive().max(3650).optional(),
  recent_weight: z.number().int().positive().max(100).optional(),
  stale_weight: z.number().int().positive().max(100).optional(),
});

export const memoryConfigSchema = z
  .object({
    /** 默认 embedded；remote 客户端实现同 MemoryService 契约 */
    deployment: memoryDeploymentSchema.optional(),
    /**
     * @deprecated 新写入请用顶层段 `passive_recall`；解析仍回退读取此处
     */
    passive_recall: passiveRecallConfigSchema.optional(),
    /**
     * @deprecated 新写入请用顶层段 `semantic_clustering`；解析仍回退读取此处
     */
    clustering: memoryClusteringConfigSchema.optional(),
    resident: memoryResidentConfigSchema.optional(),
    reference: memoryReferenceConfigSchema.optional(),
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
export type MemoryClusteringConfigInput = z.infer<typeof memoryClusteringConfigSchema>;
export type MemoryResidentConfigInput = z.infer<typeof memoryResidentConfigSchema>;
export type MemoryReferenceConfigInput = z.infer<typeof memoryReferenceConfigSchema>;

export function resolveMemoryDeployment(cfg: RuntimeConfig): MemoryDeploymentConfig {
  return cfg.memory?.deployment ?? "embedded";
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

/** 增量：新记忆并入已有族的余弦距离上限（全量 HDBSCAN 不用） */
export const DEFAULT_CLUSTERING_EPS = 0.35;
/** 全量 HDBSCAN min_cluster_size */
export const DEFAULT_CLUSTERING_MIN_POINTS = 3;
export const DEFAULT_CLUSTERING_PEEL_SMALL = false;
/** 与原 reflect FULL_JSON_BATCH 对齐 */
export const DEFAULT_CLUSTERING_MAX_BATCH_BYTES = 100_000;
/** 2C2G / 数千条量级保护上限 */
export const DEFAULT_CLUSTERING_MAX_CALIBRATE_N = 5000;

export type ResolvedMemoryClusteringConfig = {
  enabled: boolean;
  eps: number;
  min_points: number;
  min_samples: number;
  peel_small: boolean;
  max_batch_bytes: number;
  max_calibrate_n: number;
};

export function resolveMemoryClusteringConfig(cfg: RuntimeConfig): ResolvedMemoryClusteringConfig {
  const raw = cfg.semantic_clustering ?? cfg.memory?.clustering;
  const embeddingOn = isEmbeddingEnabled(cfg);
  const min_points = raw?.min_points ?? DEFAULT_CLUSTERING_MIN_POINTS;
  return {
    enabled: raw?.enabled ?? embeddingOn,
    eps: raw?.eps ?? DEFAULT_CLUSTERING_EPS,
    min_points,
    min_samples: raw?.min_samples ?? Math.max(1, min_points - 1),
    peel_small: raw?.peel_small ?? DEFAULT_CLUSTERING_PEEL_SMALL,
    max_batch_bytes: raw?.max_batch_bytes ?? DEFAULT_CLUSTERING_MAX_BATCH_BYTES,
    max_calibrate_n: raw?.max_calibrate_n ?? DEFAULT_CLUSTERING_MAX_CALIBRATE_N,
  };
}

export const DEFAULT_RESIDENT_TOP_N = 20;
export const DEFAULT_RESIDENT_PINNED_MAX = 20;
export const DEFAULT_REFERENCE_DECAY_DAYS = 30;
export const DEFAULT_REFERENCE_RECENT_WEIGHT = 2;
export const DEFAULT_REFERENCE_STALE_WEIGHT = 1;

export type ResolvedMemoryResidentConfig = {
  top_n: number;
  pinned_max: number;
};

export type ResolvedMemoryReferenceConfig = {
  decay_days: number;
  recent_weight: number;
  stale_weight: number;
};

export function resolveMemoryResidentConfig(
  cfg?: RuntimeConfig | null,
): ResolvedMemoryResidentConfig {
  const raw = cfg?.memory?.resident;
  return {
    top_n: raw?.top_n ?? DEFAULT_RESIDENT_TOP_N,
    pinned_max: raw?.pinned_max ?? DEFAULT_RESIDENT_PINNED_MAX,
  };
}

export function resolveMemoryReferenceConfig(
  cfg?: RuntimeConfig | null,
): ResolvedMemoryReferenceConfig {
  const raw = cfg?.memory?.reference;
  return {
    decay_days: raw?.decay_days ?? DEFAULT_REFERENCE_DECAY_DAYS,
    recent_weight: raw?.recent_weight ?? DEFAULT_REFERENCE_RECENT_WEIGHT,
    stale_weight: raw?.stale_weight ?? DEFAULT_REFERENCE_STALE_WEIGHT,
  };
}

export function resolvePassiveRecallConfig(cfg: RuntimeConfig): ResolvedPassiveRecallConfig {
  const raw = cfg.passive_recall ?? cfg.memory?.passive_recall;
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
