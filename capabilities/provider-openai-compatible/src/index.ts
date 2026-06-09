export {
  OPENAI_COMPATIBLE_BACKEND_ID,
  openAiCompatibleProviderConfigSchema,
  parseOpenAiCompatibleProviderSpec,
} from "./config.ts";
export type { OpenAiCompatibleProviderConfig } from "./config.ts";
export { OpenAiCompatibleBackend } from "./backend.ts";
export { wireOpenAiCompatibleLlm } from "./llm-stack-configurator.ts";
export { createOpenAiEmbeddingClient, type EmbedTextFn } from "./embedding.ts";
