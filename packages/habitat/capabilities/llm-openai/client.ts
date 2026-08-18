import OpenAI from "openai";
import {
  parseOpenAiCompatibleContext,
  resolveChatTimeouts,
  type OpenAiCompatibleContext,
} from "./context.ts";
import type { BackendContext } from "@freeanima/habitat/core/provider";
import { createSdkFetch } from "./sdk-retry-guard.ts";

export function createOpenAiClient(context: BackendContext): OpenAI {
  const cfg = parseOpenAiCompatibleContext(context);
  return createOpenAiClientFromParsed(cfg);
}

export function createOpenAiClientFromParsed(context: OpenAiCompatibleContext): OpenAI {
  const { overallMs, connectMs } = resolveChatTimeouts(context);
  return new OpenAI({
    apiKey: context.apiKey,
    baseURL: context.baseUrl,
    /** SDK 兜底 = 整体超时；连接 / 首字节 / idle 由 fetch 与 request-timeouts 控制 */
    timeout: overallMs,
    /** 配额耗尽的超长 Retry-After 禁止 SDK 睡眠重试；connect 超时见 wrapConnectTimeout */
    fetch: createSdkFetch(connectMs),
  });
}
