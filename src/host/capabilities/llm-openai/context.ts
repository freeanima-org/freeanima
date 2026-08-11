import type { BackendContext } from "@freeanima/host/core/provider";

export type OpenAiCompatibleContext = {
  baseUrl: string;
  apiKey: string;
  /** 整体墙钟超时（发请求 → 结束）；默认 {@link DEFAULT_OVERALL_TIMEOUT_MS} */
  timeoutMs?: number;
  /** 首字节超时；默认 {@link DEFAULT_FIRST_BYTE_TIMEOUT_MS}（且 ≤ overall） */
  firstByteTimeoutMs?: number;
  /** 流式 chunk idle；默认 {@link DEFAULT_IDLE_TIMEOUT_MS}（且 ≤ overall） */
  idleTimeoutMs?: number;
};

/** 整体默认：10 分钟（长生成不被 60s 误杀） */
export const DEFAULT_OVERALL_TIMEOUT_MS = 600_000;
/** 首字节默认：30s */
export const DEFAULT_FIRST_BYTE_TIMEOUT_MS = 30_000;
/** 流式 idle 默认：120s */
export const DEFAULT_IDLE_TIMEOUT_MS = 120_000;

export type ResolvedChatTimeouts = {
  overallMs: number;
  firstByteMs: number;
  idleMs: number;
};

function assertPositive(name: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`context.${name} must be positive`);
  }
}

/** 解析后用于 chat；未配置项用默认值，并保证 first/idle ≤ overall */
export function resolveChatTimeouts(context: OpenAiCompatibleContext): ResolvedChatTimeouts {
  const overallMs = context.timeoutMs ?? DEFAULT_OVERALL_TIMEOUT_MS;
  const firstByteMs = Math.min(
    context.firstByteTimeoutMs ?? DEFAULT_FIRST_BYTE_TIMEOUT_MS,
    overallMs,
  );
  const idleMs = Math.min(context.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS, overallMs);
  return { overallMs, firstByteMs, idleMs };
}

export function parseOpenAiCompatibleContext(context: BackendContext): OpenAiCompatibleContext {
  const baseUrlRaw = context.baseUrl ?? context.base_url;
  const apiKeyRaw = context.apiKey ?? context.api_key;
  const timeoutRaw = context.timeoutMs ?? context.timeout_ms;
  const firstByteRaw = context.firstByteTimeoutMs ?? context.first_byte_timeout_ms;
  const idleRaw = context.idleTimeoutMs ?? context.idle_timeout_ms;

  if (typeof baseUrlRaw !== "string" || !baseUrlRaw.trim()) {
    throw new Error("OpenAI compatible backend requires context.baseUrl");
  }
  if (typeof apiKeyRaw !== "string" || !apiKeyRaw.trim()) {
    throw new Error("OpenAI compatible backend requires context.apiKey");
  }

  const parsed: OpenAiCompatibleContext = {
    baseUrl: baseUrlRaw.replace(/\/$/, ""),
    apiKey: apiKeyRaw,
  };

  if (timeoutRaw !== undefined) {
    if (typeof timeoutRaw !== "number") throw new Error("context.timeoutMs must be positive");
    assertPositive("timeoutMs", timeoutRaw);
    parsed.timeoutMs = timeoutRaw;
  }
  if (firstByteRaw !== undefined) {
    if (typeof firstByteRaw !== "number") {
      throw new Error("context.firstByteTimeoutMs must be positive");
    }
    assertPositive("firstByteTimeoutMs", firstByteRaw);
    parsed.firstByteTimeoutMs = firstByteRaw;
  }
  if (idleRaw !== undefined) {
    if (typeof idleRaw !== "number") throw new Error("context.idleTimeoutMs must be positive");
    assertPositive("idleTimeoutMs", idleRaw);
    parsed.idleTimeoutMs = idleRaw;
  }

  const overall = parsed.timeoutMs ?? DEFAULT_OVERALL_TIMEOUT_MS;
  if (parsed.firstByteTimeoutMs != null && parsed.firstByteTimeoutMs > overall) {
    throw new Error("context.firstByteTimeoutMs must be ≤ timeoutMs (overall)");
  }
  if (parsed.idleTimeoutMs != null && parsed.idleTimeoutMs > overall) {
    throw new Error("context.idleTimeoutMs must be ≤ timeoutMs (overall)");
  }

  return parsed;
}

export function contextCacheKey(context: OpenAiCompatibleContext): string {
  return `${context.baseUrl}\0${context.apiKey}`;
}
