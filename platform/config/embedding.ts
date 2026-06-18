import type { AnimaConfig } from "@freeanima/core/config";
import { DEFAULT_EMBEDDING_DIMENSIONS, type ResolvedEmbeddingConfig } from "@freeanima/core/config";

const DEFAULT_EMBEDDING_TIMEOUT_MS = 60_000;
const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434/v1";

export type { ResolvedEmbeddingConfig };

export type EmbeddingConfigSnapshot = {
  enabled: boolean;
  model: string | null;
  base_url: string | null;
  dimensions: number;
};

function stripTrailingSlashes(url: string): string {
  let end = url.length;
  while (end > 0 && url.charCodeAt(end - 1) === 47) end--;
  return end === url.length ? url : url.slice(0, end);
}

function resolveEmbeddingBaseUrl(raw: string | undefined): string {
  const trimmed = raw?.trim();
  if (trimmed) return stripTrailingSlashes(trimmed);
  const env = process.env.OLLAMA_BASE_URL?.trim();
  if (env) return stripTrailingSlashes(env);
  return DEFAULT_OLLAMA_BASE_URL;
}

/** Whether vector search is enabled (embedding configured and not explicitly disabled) */
export function isEmbeddingEnabled(cfg: AnimaConfig): boolean {
  const embedding = cfg.embedding;
  if (embedding?.enabled === false) return false;
  const model = embedding?.model?.trim();
  if (!model) return false;
  return true;
}

export function getResolvedEmbeddingConfig(cfg: AnimaConfig): ResolvedEmbeddingConfig | null {
  if (!isEmbeddingEnabled(cfg)) return null;
  const embedding = cfg.embedding ?? {};
  const model = embedding.model?.trim();
  if (!model) return null;
  const dimensions =
    typeof embedding.dimensions === "number" && embedding.dimensions > 0
      ? embedding.dimensions
      : DEFAULT_EMBEDDING_DIMENSIONS;
  return {
    baseUrl: resolveEmbeddingBaseUrl(embedding.base_url),
    apiKey: embedding.api_key?.trim() || process.env.OLLAMA_API_KEY?.trim() || "ollama",
    model,
    dimensions,
    timeoutMs:
      typeof embedding.timeout_ms === "number" && embedding.timeout_ms > 0
        ? embedding.timeout_ms
        : DEFAULT_EMBEDDING_TIMEOUT_MS,
  };
}

export function getEmbeddingConfigSnapshot(cfg: AnimaConfig): EmbeddingConfigSnapshot {
  const resolved = getResolvedEmbeddingConfig(cfg);
  return {
    enabled: resolved != null,
    model: resolved?.model ?? null,
    base_url: resolved?.baseUrl ?? null,
    dimensions: resolved?.dimensions ?? DEFAULT_EMBEDDING_DIMENSIONS,
  };
}
