import { DEFAULT_EMBEDDING_DIMENSIONS, type ResolvedEmbeddingConfig } from "./schemas/embedding.ts";
import { EMBEDDINGS_PROTOCOL_OPENAI, type LlmConfig } from "./schemas/llm-config.ts";
import type { RuntimeConfig } from "./schemas/runtime-config.ts";
import { materializeLlmScenes, tryGetLlmConfig } from "./llm-config.ts";

export type { ResolvedEmbeddingConfig };

export type EmbeddingConfigSnapshot = {
  enabled: boolean;
  model: string | null;
  base_url: string | null;
  dimensions: number;
};

const DEFAULT_EMBEDDING_TIMEOUT_MS = 60_000;
/** Retrieval-side embed budget; hybrid fail-open when exceeded */
export const DEFAULT_EMBEDDING_QUERY_TIMEOUT_MS = 800;
const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434/v1";

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

function sceneEmbeddingFromLlm(llm: LlmConfig | undefined): {
  connection: string;
  model: string;
  dimensions?: number;
  timeout_ms?: number;
  query_timeout_ms?: number;
} | null {
  if (!llm) return null;
  const scenes = materializeLlmScenes(llm);
  const scene = scenes.embedding;
  if (!scene?.connection || !scene.model) return null;
  const provider = llm.providers[scene.connection];
  if (!provider) return null;
  if (
    provider.embeddings_protocol != null &&
    provider.embeddings_protocol !== EMBEDDINGS_PROTOCOL_OPENAI
  ) {
    return null;
  }
  // 未声明 embeddings_protocol 时仍允许（兼容仅配 scenes 的迁移期）
  const dims = scene.params?.dimensions;
  const timeout = scene.params?.timeout_ms;
  const queryTimeout = scene.params?.query_timeout_ms;
  return {
    connection: scene.connection,
    model: scene.model,
    ...(typeof dims === "number" ? { dimensions: dims } : {}),
    ...(typeof timeout === "number" ? { timeout_ms: timeout } : {}),
    ...(typeof queryTimeout === "number" ? { query_timeout_ms: queryTimeout } : {}),
  };
}

/** Whether vector search is enabled (scene or legacy embedding configured) */
export function isEmbeddingEnabled(cfg: RuntimeConfig): boolean {
  const embedding = cfg.embedding;
  if (embedding?.enabled === false) return false;

  const fromScene = sceneEmbeddingFromLlm(tryGetLlmConfig(cfg));
  if (fromScene) return true;

  const model = embedding?.model?.trim();
  if (!model) return false;
  return true;
}

export function getResolvedEmbeddingConfig(cfg: RuntimeConfig): ResolvedEmbeddingConfig | null {
  if (cfg.embedding?.enabled === false) return null;

  const llm = tryGetLlmConfig(cfg);
  const fromScene = sceneEmbeddingFromLlm(llm);
  if (fromScene && llm) {
    const provider = llm.providers[fromScene.connection];
    const baseUrl = resolveEmbeddingBaseUrl(provider?.base_url);
    const apiKey =
      provider?.api_key?.trim() ||
      cfg.embedding?.api_key?.trim() ||
      process.env.OLLAMA_API_KEY?.trim() ||
      "ollama";
    const dimensions =
      fromScene.dimensions && fromScene.dimensions > 0
        ? fromScene.dimensions
        : typeof cfg.embedding?.dimensions === "number" && cfg.embedding.dimensions > 0
          ? cfg.embedding.dimensions
          : DEFAULT_EMBEDDING_DIMENSIONS;
    return {
      baseUrl,
      apiKey,
      model: fromScene.model,
      dimensions,
      timeoutMs:
        fromScene.timeout_ms && fromScene.timeout_ms > 0
          ? fromScene.timeout_ms
          : typeof cfg.embedding?.timeout_ms === "number" && cfg.embedding.timeout_ms > 0
            ? cfg.embedding.timeout_ms
            : DEFAULT_EMBEDDING_TIMEOUT_MS,
      queryTimeoutMs: getEmbeddingQueryTimeoutMs(cfg, fromScene.query_timeout_ms),
    };
  }

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
    queryTimeoutMs: getEmbeddingQueryTimeoutMs(cfg),
  };
}

/** Query-time embed deadline (fail-open); independent of write-path timeout_ms */
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
