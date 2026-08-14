import { ensureTokenizer, setResolveContext } from "@freeanima/habitat/core/tokenizer";
import type { RuntimeConfig, Config } from "@freeanima/habitat/core/config";
import {
  getDefaultProviderBaseUrl,
  getProfileHopModel,
  getResolvedEmbeddingConfig,
  isEmbeddingEnabled,
} from "@freeanima/habitat/platform/config";
import { logComponent } from "@freeanima/habitat/platform/logging";
import { PROFILE_CHAT } from "@freeanima/habitat/core/provider";

const log = logComponent("tokenizer");

function collectOllamaBaseUrls(cfg: RuntimeConfig): string[] {
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
    const chatBaseUrl = getDefaultProviderBaseUrl(cfg);
    if (chatBaseUrl.includes("11434") || chatBaseUrl.toLowerCase().includes("ollama")) {
      add(chatBaseUrl);
    }
  } catch {
    // chat provider 未配置时跳过
  }

  return urls;
}

/** Bind chat/embedding models to in-process tokenx estimate (no HF vocab preload). */
export async function bindTokenizerRuntime(config: Config): Promise<void> {
  const cfg = config.data;
  setResolveContext({ ollamaBaseUrls: collectOllamaBaseUrls(cfg) });

  const tasks: Promise<void>[] = [];

  try {
    const chatModel = getProfileHopModel(cfg, PROFILE_CHAT);
    tasks.push(
      ensureTokenizer(chatModel).catch((err) => {
        log.warn("chat tokenizer bind failed", { model: chatModel, error: String(err) });
      }),
    );
  } catch (err) {
    log.warn("chat model not configured for tokenizer bind", { error: String(err) });
  }

  if (isEmbeddingEnabled(cfg)) {
    const embeddingModel = cfg.embedding?.model?.trim();
    if (embeddingModel) {
      tasks.push(
        ensureTokenizer(embeddingModel).catch((err) => {
          log.warn("embedding tokenizer bind failed", {
            model: embeddingModel,
            error: String(err),
          });
        }),
      );
    }
  }

  await Promise.all(tasks);
  log.info("tokenizer runtime bound (tokenx estimate)");
}
