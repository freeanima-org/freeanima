import { ensureTokenizer, setResolveContext } from "@freeanima/core/tokenizer";
import type { AnimaConfig, Config } from "@freeanima/core/config";
import {
  getDefaultProviderBaseUrl,
  getProfileHopModel,
  getResolvedEmbeddingConfig,
  isEmbeddingEnabled,
} from "@freeanima/platform/config";
import { logComponent } from "@freeanima/platform/logging";
import { PROFILE_CHAT } from "@freeanima/core/provider";

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
export async function wireTokenizerRuntime(config: Config): Promise<void> {
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
  log.info("tokenizer runtime wired (tokenx estimate)");
}
