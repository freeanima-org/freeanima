import {
  ensureTokenizer,
  setResolveContext,
  startTokenizerReconcile,
} from "@freeanima/storage-tokenizer";
import type { AnimaConfig, Config } from "@freeanima/storage-config";
import {
  getDefaultProviderBaseUrl,
  getProfileHopModel,
  getResolvedEmbeddingConfig,
  isEmbeddingEnabled,
} from "@freeanima/service-config";
import { logComponent } from "@freeanima/service-logging";
import { PROFILE_CHAT } from "@freeanima/storage-provider-llm";

const log = logComponent("tokenizer");

function collectOllamaBaseUrls(cfg: AnimaConfig): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  const add = (raw: string | undefined | null): void => {
    const u = raw?.trim();
    if (!u || seen.has(u)) return;
    seen.add(u);
    urls.push(u);
  };

  if (isEmbeddingEnabled(cfg)) {
    const embedding = getResolvedEmbeddingConfig(cfg);
    if (embedding?.baseUrl) add(embedding.baseUrl);
  }

  try {
    add(getDefaultProviderBaseUrl(cfg));
  } catch {
    // chat provider 未配置时跳过
  }

  return urls;
}

/** Preload configured chat/embedding model tokenizers; fallback loads only on resolve failure. */
export async function wireTokenizerRuntime(config: Config): Promise<void> {
  const cfg = config.data;
  setResolveContext({ ollamaBaseUrls: collectOllamaBaseUrls(cfg) });

  const tasks: Promise<void>[] = [];

  try {
    const chatModel = getProfileHopModel(cfg, PROFILE_CHAT);
    tasks.push(
      ensureTokenizer(chatModel).catch((err) => {
        log.warn("chat tokenizer preload failed", { model: chatModel, error: String(err) });
      }),
    );
  } catch (err) {
    log.warn("chat model not configured for tokenizer preload", { error: String(err) });
  }

  if (isEmbeddingEnabled(cfg)) {
    const embeddingModel = cfg.embedding?.model?.trim();
    if (embeddingModel) {
      tasks.push(
        ensureTokenizer(embeddingModel).catch((err) => {
          log.warn("embedding tokenizer preload failed", {
            model: embeddingModel,
            error: String(err),
          });
        }),
      );
    }
  }

  await Promise.all(tasks);
  startTokenizerReconcile();
  log.info("tokenizer runtime wired");
}
