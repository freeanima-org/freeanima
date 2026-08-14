/** Provider-layer generalized error codes; HTTP/SDK details mapped by Backend impl */
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

export type ProviderErrorOptions = {
  providerId?: string;
  profileId?: string;
  model?: string;
  /** 0-based hop index within profile.chain when known */
  hopIndex?: number;
  cause?: unknown;
};

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly code: ProviderErrorCode,
    readonly retryable: boolean,
    readonly options?: ProviderErrorOptions,
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "ProviderError";
  }

  get providerId(): string | undefined {
    return this.options?.providerId;
  }

  get profileId(): string | undefined {
    return this.options?.profileId;
  }

  get model(): string | undefined {
    return this.options?.model;
  }

  get hopIndex(): number | undefined {
    return this.options?.hopIndex;
  }
}

import { omitUndefined } from "@freeanima/habitat/core/util";

/** Attach profile/provider/model to message + options (idempotent if already tagged). */
export function withLlmRouteContext(
  err: ProviderError,
  route: {
    profileId: string;
    providerId: string;
    model: string;
    hopIndex?: number;
  },
): ProviderError {
  const hopPart = route.hopIndex !== undefined ? ` hop=${route.hopIndex}` : "";
  const tag = `[profile=${route.profileId} provider=${route.providerId} model=${route.model}${hopPart}]`;
  const message = /\[profile=/.test(err.message) ? err.message : `${err.message} ${tag}`;
  return new ProviderError(
    message,
    err.code,
    err.retryable,
    omitUndefined({
      providerId: route.providerId,
      profileId: route.profileId,
      model: route.model,
      hopIndex: route.hopIndex,
      cause: err.options?.cause !== undefined ? err.options.cause : err,
    }),
  );
}

/**
 * Whether profile.chain should try the next hop after this failure.
 * UI documents multi-hop as standby routes; do not failover on client cancel / bad request / filter.
 */
export function shouldFailoverToNextHop(err: ProviderError): boolean {
  switch (err.code) {
    case "cancelled":
    case "invalid_request":
    case "content_filtered":
      return false;
    default:
      return true;
  }
}

/** Fallback trusts ProviderError.retryable only; unknown errors are fatal */
export function classifyProviderError(err: unknown): ErrorClassification {
  if (err instanceof ProviderError) {
    return err.retryable ? "retryable" : "fatal";
  }
  return "fatal";
}

export function isProviderError(err: unknown): err is ProviderError {
  return err instanceof ProviderError;
}

/** Backend impl helper: coarse HTTP status → ProviderError mapping (optional) */
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
