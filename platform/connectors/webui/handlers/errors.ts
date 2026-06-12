import { logApiError } from "../api-logging.ts";

export class ApiHandlerError extends Error {
  readonly status: 400 | 404 | 500 | 503;
  readonly context?: Record<string, unknown>;

  constructor(status: 400 | 404 | 500 | 503, message: string, context?: Record<string, unknown>) {
    super(message);
    this.name = "ApiHandlerError";
    this.status = status;
    this.context = context;
  }
}

export function apiErrorBody(error: ApiHandlerError): {
  error: string;
  code?: string;
  params?: Record<string, string>;
} {
  const code = typeof error.context?.code === "string" ? error.context.code : undefined;
  const params =
    error.context?.params && typeof error.context.params === "object"
      ? (error.context.params as Record<string, string>)
      : undefined;
  return { error: error.message, ...(code ? { code, params } : {}) };
}

export function logHandlerError(
  method: string,
  path: string,
  err: unknown,
  context?: Record<string, unknown>,
): never {
  if (err instanceof ApiHandlerError) {
    logApiError(method, path, err.status, err.message, err.context ?? context);
    throw err;
  }
  const message = String(err);
  logApiError(method, path, 500, message, context);
  throw new ApiHandlerError(500, message, context);
}

export function jsonError(status: 400 | 404 | 500 | 503, message: string): Response {
  return Response.json({ error: message }, { status });
}
