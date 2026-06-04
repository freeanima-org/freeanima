import type { BackendContext } from "@freeanima/engine-provider-llm";

export type OpenAiCompatibleContext = {
  baseUrl: string;
  apiKey: string;
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 60_000;

export function parseOpenAiCompatibleContext(context: BackendContext): OpenAiCompatibleContext {
  const baseUrlRaw = context.baseUrl ?? context.base_url;
  const apiKeyRaw = context.apiKey ?? context.api_key;
  const timeoutRaw = context.timeoutMs ?? context.timeout_ms;

  if (typeof baseUrlRaw !== "string" || !baseUrlRaw.trim()) {
    throw new Error("OpenAI 兼容 backend 需要 context.baseUrl");
  }
  if (typeof apiKeyRaw !== "string" || !apiKeyRaw.trim()) {
    throw new Error("OpenAI 兼容 backend 需要 context.apiKey");
  }

  const parsed: OpenAiCompatibleContext = {
    baseUrl: baseUrlRaw.replace(/\/$/, ""),
    apiKey: apiKeyRaw,
  };

  if (timeoutRaw !== undefined) {
    if (typeof timeoutRaw !== "number" || timeoutRaw <= 0) {
      throw new Error("context.timeoutMs 必须为正数");
    }
    parsed.timeoutMs = timeoutRaw;
  }

  return parsed;
}

export function contextCacheKey(context: OpenAiCompatibleContext): string {
  return `${context.baseUrl}\0${context.apiKey}`;
}

export { DEFAULT_TIMEOUT_MS };
