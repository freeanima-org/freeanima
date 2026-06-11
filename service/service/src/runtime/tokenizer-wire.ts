import { ensureFallbackTokenizer, ensureTokenizer } from "@freeanima/engine-tokenizer";
import { getProfileHopModel, isEmbeddingEnabled, loadConfig } from "@freeanima/service-config";
import { logComponent } from "@freeanima/service-logging";
import { PROFILE_CHAT } from "@freeanima/engine-provider-llm";

const log = logComponent("tokenizer");

/** Preload fallback + configured chat/embedding model tokenizers (non-blocking failures). */
export async function wireTokenizerRuntime(): Promise<void> {
  const cfg = loadConfig();
  const tasks: Promise<void>[] = [
    ensureFallbackTokenizer().catch((err) => {
      log.warn("fallback tokenizer preload failed", { error: String(err) });
    }),
  ];

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

  if (isEmbeddingEnabled()) {
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
  log.info("tokenizer runtime wired");
}
