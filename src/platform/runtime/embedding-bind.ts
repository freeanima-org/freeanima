import {
  createOpenAiEmbeddingBatchClient,
  createOpenAiEmbeddingClient,
} from "@freeanima/capabilities/llm-openai";
import { registerEmbedTextFn, registerEmbedTextsFn } from "@freeanima/core/db/pg";
import type { Config } from "@freeanima/core/config";
import { getResolvedEmbeddingConfig } from "@freeanima/platform/config";
import { logComponent } from "@freeanima/platform/logging";

const log = logComponent("embedding");

/** Register OpenAI-compatible embedding client per config.embedding */
export function bindEmbeddingRuntime(config: Config): void {
  const cfg = getResolvedEmbeddingConfig(config.data);
  if (!cfg) {
    registerEmbedTextFn(null);
    registerEmbedTextsFn(null);
    return;
  }
  registerEmbedTextFn(createOpenAiEmbeddingClient(cfg));
  registerEmbedTextsFn(createOpenAiEmbeddingBatchClient(cfg));
  log.info("embedding enabled", {
    model: cfg.model,
    base_url: cfg.baseUrl,
    dimensions: cfg.dimensions,
  });
}
