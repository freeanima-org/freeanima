import { createOpenAiEmbeddingClient } from "@freeanima/capabilities-provider-openai-compatible";
import { registerEmbedTextFn, registerEmbedTextsFn } from "@freeanima/connectors-db-pg";
import { getResolvedEmbeddingConfig } from "@freeanima/service-config";
import { logComponent } from "@freeanima/service-logging";

const log = logComponent("embedding");

/** Register OpenAI-compatible embedding client per config.embedding */
export function wireEmbeddingRuntime(): void {
  const cfg = getResolvedEmbeddingConfig();
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
