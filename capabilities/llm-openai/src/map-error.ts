import { APIError } from "openai";
import {
  ProviderError,
  providerErrorFromHttpStatus,
  type ProviderErrorCode,
} from "@freeanima/core/provider";
import { omitUndefined } from "@freeanima/core/util";

function mapOpenAiErrorCode(status: number | undefined): ProviderErrorCode {
  if (status === 429) return "rate_limited";
  if (status === 401 || status === 403) return "authentication";
  if (status === 404) return "model_not_found";
  if (status === 408) return "timeout";
  if (status === 502 || status === 503 || status === 504) return "unavailable";
  if (status != null && status >= 400 && status < 500) return "invalid_request";
  if (status != null && status >= 500) return "unavailable";
  return "unknown";
}

function isRetryableCode(code: ProviderErrorCode): boolean {
  return code === "rate_limited" || code === "unavailable" || code === "timeout";
}

export function mapOpenAiCompatibleError(
  err: unknown,
  meta?: { providerId?: string },
): ProviderError {
  if (err instanceof ProviderError) {
    return err;
  }

  if (err instanceof APIError) {
    const status = err.status ?? 0;
    return providerErrorFromHttpStatus(
      status,
      err.message,
      omitUndefined({
        providerId: meta?.providerId,
        cause: err,
      }),
    );
  }

  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes("timeout") || msg.includes("timed out")) {
      return new ProviderError(
        err.message,
        "timeout",
        true,
        omitUndefined({
          providerId: meta?.providerId,
          cause: err,
        }),
      );
    }
    if (msg.includes("abort") || err.name === "AbortError") {
      return new ProviderError(
        err.message,
        "cancelled",
        false,
        omitUndefined({
          providerId: meta?.providerId,
          cause: err,
        }),
      );
    }
  }

  const message = err instanceof Error ? err.message : String(err);
  const code = mapOpenAiErrorCode(undefined);
  return new ProviderError(
    message,
    code,
    isRetryableCode(code),
    omitUndefined({
      providerId: meta?.providerId,
      cause: err,
    }),
  );
}
