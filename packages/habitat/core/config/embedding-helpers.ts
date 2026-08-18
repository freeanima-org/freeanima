import { DEFAULT_EMBEDDING_DIMENSIONS, type ResolvedEmbeddingConfig } from "./schemas/embedding.ts";
import { EMBEDDINGS_PROTOCOL_OPENAI } from "./schemas/llm-config.ts";
import type { RuntimeConfig } from "./schemas/runtime-config.ts";
import { bindingComplete } from "./schemas/capability.ts";
import { getConnection } from "./llm-config.ts";
import { effectiveProviderModalities, connectionEndpointUrl } from "../llm/presets.ts";

export type { ResolvedEmbeddingConfig };

export type EmbeddingConfigSnapshot = {
  enabled: boolean;
  model: string | null;
  base_url: string | null;
  dimensions: number;
};

const DEFAULT_EMBEDDING_TIMEOUT_MS = 60_000;
export const DEFAULT_EMBEDDING_QUERY_TIMEOUT_MS = 800;

function stripTrailingSlashes(url: string): string {
  let end = url.length;
  while (end > 0 && url.charCodeAt(end - 1) === 47) end--;
  return end === url.length ? url : url.slice(0, end);
}

function connectionEmbeddingBaseUrl(connectionId: string, cfg: RuntimeConfig): string | null {
  const provider = getConnection(cfg, connectionId);
  if (!provider) return null;
  const modalities = effectiveProviderModalities(provider);
  if (
    modalities.embeddings_protocol != null &&
    modalities.embeddings_protocol !== EMBEDDINGS_PROTOCOL_OPENAI
  ) {
    return null;
  }
  try {
    return stripTrailingSlashes(connectionEndpointUrl(provider));
  } catch {
    return null;
  }
}

/** Whether vector search is enabled */
export function isEmbeddingEnabled(cfg: RuntimeConfig): boolean {
  const embedding = cfg.embedding;
  if (embedding?.enabled === false) return false;
  return bindingComplete(embedding?.main);
}

export function getResolvedEmbeddingConfig(cfg: RuntimeConfig): ResolvedEmbeddingConfig | null {
  if (cfg.embedding?.enabled === false) return null;
  const main = cfg.embedding?.main;
  if (!bindingComplete(main)) return null;
  const provider = getConnection(cfg, main.connection);
  if (!provider) return null;
  const baseUrl = connectionEmbeddingBaseUrl(main.connection, cfg);
  if (!baseUrl) return null;
  const apiKey = provider.api_key?.trim() || process.env.OLLAMA_API_KEY?.trim() || "ollama";
  const dimensions =
    typeof cfg.embedding?.dimensions === "number" && cfg.embedding.dimensions > 0
      ? cfg.embedding.dimensions
      : DEFAULT_EMBEDDING_DIMENSIONS;
  return {
    baseUrl,
    apiKey,
    model: main.model.trim(),
    dimensions,
    timeoutMs:
      typeof cfg.embedding?.timeout_ms === "number" && cfg.embedding.timeout_ms > 0
        ? cfg.embedding.timeout_ms
        : DEFAULT_EMBEDDING_TIMEOUT_MS,
    queryTimeoutMs: getEmbeddingQueryTimeoutMs(cfg),
  };
}

export function getEmbeddingQueryTimeoutMs(cfg: RuntimeConfig, sceneOverride?: number): number {
  if (typeof sceneOverride === "number" && sceneOverride > 0) return sceneOverride;
  const raw = cfg.embedding?.query_timeout_ms;
  if (typeof raw === "number" && raw > 0) return raw;
  return DEFAULT_EMBEDDING_QUERY_TIMEOUT_MS;
}

export function getEmbeddingConfigSnapshot(cfg: RuntimeConfig): EmbeddingConfigSnapshot {
  const resolved = getResolvedEmbeddingConfig(cfg);
  return {
    enabled: resolved != null,
    model: resolved?.model ?? null,
    base_url: resolved?.baseUrl ?? null,
    dimensions: resolved?.dimensions ?? DEFAULT_EMBEDDING_DIMENSIONS,
  };
}
