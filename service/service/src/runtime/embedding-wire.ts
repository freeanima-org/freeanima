import { createOpenAiEmbeddingClient } from "@freeanima/capabilities-llm-openai";
import { registerEmbedTextFn, registerEmbedTextsFn } from "@freeanima/connectors-db-pg";
import type { Config } from "@freeanima/storage-config";
import { getResolvedEmbeddingConfig } from "@freeanima/service-config";
import { logComponent } from "@freeanima/service-logging";

const log = logComponent("embedding");

/** Register OpenAI-compatible embedding client per config.embedding */
export function wireEmbeddingRuntime(config: Config): void {
  const cfg = getResolvedEmbeddingConfig(config.data);
  if (!cfg) {
    registerEmbedTextFn(null);
    registerEmbedTextsFn(null);
    return;
  }
  registerEmbedTextFn(createOpenAiEmbeddingClient(cfg));
  registerEmbedTextsFn(null);
  log.info("embedding enabled", {
    model: cfg.model,
    base_url: cfg.baseUrl,
    dimensions: cfg.dimensions,
  });
}
