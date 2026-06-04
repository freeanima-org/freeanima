/** Provider 层泛化错误码；HTTP/SDK 细节由 Backend 实现映射为此处 */
export type ProviderErrorCode =
  | "rate_limited"
  | "unavailable"
  | "timeout"
  | "authentication"
  | "invalid_request"
  | "model_not_found"
  | "content_filtered"
  | "cancelled"
  | "unknown";

export type ErrorClassification = "retryable" | "fatal";

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly code: ProviderErrorCode,
    readonly retryable: boolean,
    readonly options?: {
      providerId?: string;
      cause?: unknown;
    },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "ProviderError";
  }

  get providerId(): string | undefined {
    return this.options?.providerId;
  }
}

/** Fallback 仅信任 ProviderError.retryable；未知错误一律 fatal */
export function classifyProviderError(err: unknown): ErrorClassification {
  if (err instanceof ProviderError) {
    return err.retryable ? "retryable" : "fatal";
  }
  return "fatal";
}

export function isProviderError(err: unknown): err is ProviderError {
  return err instanceof ProviderError;
}

/** Backend 实现侧辅助：按 HTTP 状态粗映射为 ProviderError（可选使用） */
export function providerErrorFromHttpStatus(
  status: number,
  message: string,
  options?: { providerId?: string; cause?: unknown },
): ProviderError {
  if (status === 429) {
    return new ProviderError(message, "rate_limited", true, options);
  }
  if (status === 401 || status === 403) {
    return new ProviderError(message, "authentication", false, options);
  }
  if (status === 404) {
    return new ProviderError(message, "model_not_found", false, options);
  }
  if (status === 408) {
    return new ProviderError(message, "timeout", true, options);
  }
  if (status === 502 || status === 503 || status === 504) {
    return new ProviderError(message, "unavailable", true, options);
  }
  if (status >= 400 && status < 500) {
    return new ProviderError(message, "invalid_request", false, options);
  }
  if (status >= 500) {
    return new ProviderError(message, "unavailable", true, options);
  }
  return new ProviderError(message, "unknown", false, options);
}
