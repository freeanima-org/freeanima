import { createOpenAiEmbeddingClient } from "@freeanima/capabilities-provider-openai-compatible";
import { registerEmbedTextFn } from "@freeanima/connectors-db-pg";
import { getResolvedEmbeddingConfig } from "@freeanima/service-config";
import { logComponent } from "@freeanima/service-logging";

const log = logComponent("embedding");

/** 按 config.embedding 注册 OpenAI 兼容 embedding 客户端 */
export function wireEmbeddingRuntime(): void {
  const cfg = getResolvedEmbeddingConfig();
  if (!cfg) {
    registerEmbedTextFn(null);
    return;
  }
  registerEmbedTextFn(createOpenAiEmbeddingClient(cfg));
  log.info("embedding 已启用", {
    model: cfg.model,
    base_url: cfg.baseUrl,
    dimensions: cfg.dimensions,
  });
}
