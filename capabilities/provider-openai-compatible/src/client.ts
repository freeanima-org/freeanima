import OpenAI from "openai";
import {
  DEFAULT_TIMEOUT_MS,
  parseOpenAiCompatibleContext,
  type OpenAiCompatibleContext,
} from "./context";
import type { BackendContext } from "@freeanima/engine-provider-llm";

export function createOpenAiClient(context: BackendContext): OpenAI {
  const cfg = parseOpenAiCompatibleContext(context);
  return createOpenAiClientFromParsed(cfg);
}

export function createOpenAiClientFromParsed(context: OpenAiCompatibleContext): OpenAI {
  return new OpenAI({
    apiKey: context.apiKey,
    baseURL: context.baseUrl,
    timeout: context.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  });
}
