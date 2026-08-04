import OpenAI from "openai";
import {
  DEFAULT_OVERALL_TIMEOUT_MS,
  parseOpenAiCompatibleContext,
  type OpenAiCompatibleContext,
} from "./context.ts";
import type { BackendContext } from "@freeanima/host/core/provider";

export function createOpenAiClient(context: BackendContext): OpenAI {
  const cfg = parseOpenAiCompatibleContext(context);
  return createOpenAiClientFromParsed(cfg);
}

export function createOpenAiClientFromParsed(context: OpenAiCompatibleContext): OpenAI {
  return new OpenAI({
    apiKey: context.apiKey,
    baseURL: context.baseUrl,
    /** SDK 兜底 = 整体超时；首字节 / idle 由 request-timeouts 应用层控制 */
    timeout: context.timeoutMs ?? DEFAULT_OVERALL_TIMEOUT_MS,
  });
}
