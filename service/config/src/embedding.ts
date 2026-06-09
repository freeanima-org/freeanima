import { loadConfig } from "./config.ts";
import { DEFAULT_EMBEDDING_DIMENSIONS } from "./schemas/embedding.ts";

const DEFAULT_EMBEDDING_TIMEOUT_MS = 60_000;
const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434/v1";

export type ResolvedEmbeddingConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
  dimensions: number;
  timeoutMs: number;
};

export type EmbeddingConfigSnapshot = {
  enabled: boolean;
  model: string | null;
  base_url: string | null;
  dimensions: number;
};

function resolveEmbeddingBaseUrl(raw: string | undefined): string {
  const trimmed = raw?.trim();
  if (trimmed) return trimmed.replace(/\/+$/, "");
  const env = process.env.OLLAMA_BASE_URL?.trim();
  if (env) return env.replace(/\/+$/, "");
  return DEFAULT_OLLAMA_BASE_URL;
}

/** 是否启用向量检索（配置 embedding 且未显式 disabled） */
export function isEmbeddingEnabled(): boolean {
  const cfg = loadConfig().embedding;
  if (cfg?.enabled === false) return false;
  const model = cfg?.model?.trim();
  if (!model) return false;
  return true;
}

export function getResolvedEmbeddingConfig(): ResolvedEmbeddingConfig | null {
  if (!isEmbeddingEnabled()) return null;
  const cfg = loadConfig().embedding ?? {};
  const model = cfg.model?.trim();
  if (!model) return null;
  const dimensions =
    typeof cfg.dimensions === "number" && cfg.dimensions > 0
      ? cfg.dimensions
      : DEFAULT_EMBEDDING_DIMENSIONS;
  return {
    baseUrl: resolveEmbeddingBaseUrl(cfg.base_url),
    apiKey: cfg.api_key?.trim() || process.env.OLLAMA_API_KEY?.trim() || "ollama",
    model,
    dimensions,
    timeoutMs:
      typeof cfg.timeout_ms === "number" && cfg.timeout_ms > 0
        ? cfg.timeout_ms
        : DEFAULT_EMBEDDING_TIMEOUT_MS,
  };
}

export function getEmbeddingConfigSnapshot(): EmbeddingConfigSnapshot {
  const resolved = getResolvedEmbeddingConfig();
  return {
    enabled: resolved != null,
    model: resolved?.model ?? null,
    base_url: resolved?.baseUrl ?? null,
    dimensions: resolved?.dimensions ?? DEFAULT_EMBEDDING_DIMENSIONS,
  };
}
