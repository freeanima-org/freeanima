import OpenAI from "openai";
import {
  parseOpenAiCompatibleContext,
  resolveChatTimeouts,
  type OpenAiCompatibleContext,
} from "./context.ts";
import type { BackendContext } from "@freeanima/core/provider";
import { createSdkFetch } from "./sdk-retry-guard.ts";

/**
 * SDK 重试策略。
 *
 * 默认沿用 SDK 的 2 次重试：chat / embeddings / images / TTS / ASR 都依赖它吸收
 * 瞬时 429 / 5xx，应用层没有等价的补偿重试。
 * 可选增强型调用（`/models` 目录查询）不该靠重试拖慢调用方，那里显式传
 * `retries: 0` 并自行用 AbortSignal 划预算。
 */
export type OpenAiClientOptions = {
  /** SDK 自动重试次数；默认不传 = SDK 默认（2） */
  retries?: number;
};

export function createOpenAiClient(context: BackendContext): OpenAI {
  const cfg = parseOpenAiCompatibleContext(context);
  return createOpenAiClientFromParsed(cfg);
}

export function createOpenAiClientFromParsed(
  context: OpenAiCompatibleContext,
  options: OpenAiClientOptions = {},
): OpenAI {
  const { overallMs, connectMs } = resolveChatTimeouts(context);
  return new OpenAI({
    apiKey: context.apiKey,
    baseURL: context.baseUrl,
    /** SDK 兜底 = 整体超时；连接 / 首字节 / idle 由 fetch 与 request-timeouts 控制 */
    timeout: overallMs,
    ...(options.retries !== undefined ? { maxRetries: options.retries } : {}),
    /** 配额耗尽的超长 Retry-After 禁止 SDK 睡眠重试；connect 超时见 wrapConnectTimeout */
    fetch: createSdkFetch(connectMs),
  });
}
